import { expect } from "chai";
import { WebSocket } from "ws";
import { MaybeType } from "maybe"
import { newBroker, Broker, BrokerMemory, closeBroker } from "./broker.js"
import { newSingleEvent, IndexedEvent, SingleEvent, 
newMultipleEventRequest, isMultipleEventsResponse
} from "broker-types"

describe("testing memory persistence for memory", () => {
	it("can append and then get all the events...", () => {
		const bm = new BrokerMemory();
		bm.append({name: "hello"});
		bm.append({name: "there"});
		bm.append({name: "world"});
		const value: IndexedEvent[] = bm.getAll();

		const e1: IndexedEvent = { index: 0, event: {name: "hello"} };
		const e2: IndexedEvent = { index: 1, event: {name: "there"} };
		const e3: IndexedEvent = { index: 2, event: {name: "world"} };
		expect(value).to.deep.equal([e1, e2, e3])
	})
})

describe("use broker to send to a client...", () => {
	let broker: Broker;
	let ws: WebSocket;

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

		const myWSPromise: Promise<WebSocket> = new Promise(res => {
			try {
				const myWs = new WebSocket("ws://localhost:8081");
				myWs.on("open", () => {
					res(myWs)
				})
			} catch {
				expect.fail("web socket failed to connect")
			}
			
		})

		ws = await myWSPromise;
		
	})

	afterEach(async () => {
		await closeBroker(broker)
	})

	it("will send an event to a local reciever upon receipt", async () => {
		const event = { name: "hello" }; 
	
		const msgPromise: Promise<SingleEvent> = new Promise(res => {
			ws.on("message", (data: string) => {
				res(JSON.parse(data));
			})
		})
		ws.send(JSON.stringify(newSingleEvent(event)));
		const myEvent: SingleEvent = await msgPromise;
		expect(myEvent.event).to.deep.equal(event)
	})

	it("can get an array of past events upon request", async ()=> {
		const event1 = { name: "hello" };
		const event2 = { name: "there" };
		
		const eventsPromise: Promise<IndexedEvent[]> = new Promise(res => {
			ws.on("message", (data: string) => {
				const event = JSON.parse(data);
				if (isMultipleEventsResponse(event)) {
					res(event.events)
				}
			})
			ws.send(JSON.stringify(newSingleEvent(event1)));	
			ws.send(JSON.stringify(newSingleEvent(event2)));
			ws.send(JSON.stringify(newMultipleEventRequest()));
		})

		const myEvents: IndexedEvent[] = await eventsPromise;

		expect(myEvents).to.deep.equal([
			{index: 0, event: newSingleEvent(event1)}, 
			{index: 1, event: newSingleEvent(event2)}, 
		]);
	})
})

