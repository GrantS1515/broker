import { expect } from "chai";
import { WebSocket } from "ws";
import { MaybeType } from "maybe";
import { newBroker, BrokerMemory, closeBroker } from "./broker.js";
import { newSingleEvent, newMultipleEventRequest, isMultipleEventsResponse } from "broker-types";
describe("testing memory persistence for memory", () => {
    it("can append and then get all the events...", () => {
        const bm = new BrokerMemory();
        bm.append({ name: "hello" });
        bm.append({ name: "there" });
        bm.append({ name: "world" });
        const value = bm.getAll();
        const e1 = { index: 0, event: { name: "hello" } };
        const e2 = { index: 1, event: { name: "there" } };
        const e3 = { index: 2, event: { name: "world" } };
        expect(value).to.deep.equal([e1, e2, e3]);
    });
});
describe("use broker to send to a client...", () => {
    let broker;
    let ws;
    beforeEach(async () => {
        const mem = new BrokerMemory();
        const maybeBroker = await newBroker(8081, mem);
        switch (maybeBroker.type) {
            case MaybeType.Just:
                broker = maybeBroker.value;
                break;
            case MaybeType.Nothing:
                expect.fail("Unable to create a web socket server");
                break;
        }
        const myWSPromise = new Promise(res => {
            try {
                const myWs = new WebSocket("ws://localhost:8081");
                myWs.on("open", () => {
                    res(myWs);
                });
            }
            catch {
                expect.fail("web socket failed to connect");
            }
        });
        ws = await myWSPromise;
    });
    afterEach(async () => {
        await closeBroker(broker);
    });
    it("will send an event to a local reciever upon receipt", async () => {
        const event = { name: "hello" };
        const msgPromise = new Promise(res => {
            ws.on("message", (data) => {
                res(JSON.parse(data));
            });
        });
        ws.send(JSON.stringify(newSingleEvent(event)));
        const myEvent = await msgPromise;
        expect(myEvent.event).to.deep.equal(event);
    });
    it("can get an array of past events upon request", async () => {
        const event1 = { name: "hello" };
        const event2 = { name: "there" };
        const eventsPromise = new Promise(res => {
            ws.on("message", (data) => {
                const event = JSON.parse(data);
                if (isMultipleEventsResponse(event)) {
                    res(event.events);
                }
            });
            ws.send(JSON.stringify(newSingleEvent(event1)));
            ws.send(JSON.stringify(newSingleEvent(event2)));
            ws.send(JSON.stringify(newMultipleEventRequest()));
        });
        const myEvents = await eventsPromise;
        expect(myEvents).to.deep.equal([
            { index: 0, event: newSingleEvent(event1) },
            { index: 1, event: newSingleEvent(event2) },
        ]);
    });
});
