import { expect } from "chai";
import { WebSocket } from "ws";
import { MaybeType, Maybe } from "maybe/src/maybe.js"
import { newBroker, Broker, BrokerMemory, closeBroker, newSingleEvent,
	IndexedBrokerEvent, SingleEvent, newMultipleEventRequest, 
	isMultipleEventsResponse, MultipleEventsResponse,
} from "./broker.js"

// describe("testing helper functions", () => {
// 	it("can create a string broker event from basics", () => {
// 		const myEvent = { name: "hello", otherData: 5 };
// 		const myStr = newBrokerEventString(myEvent, BrokerEventClass.single);
// 		const goalObj: BrokerEvent = JSON.parse(myStr);

// 		expect(goalObj.event).to.deep.equal(myEvent);
// 		expect(goalObj.eventClass).to.equal(BrokerEventClass.single);
// 	})
// })

describe("testing memory persistence for memory", () => {
	it("can append and then get all the events...", () => {
		const bm = new BrokerMemory();
		bm.append({name: "hello"});
		bm.append({name: "there"});
		bm.append({name: "world"});
		const value: IndexedBrokerEvent[] = bm.getAll();

		const e1: IndexedBrokerEvent = { index: 0, event: {name: "hello"} };
		const e2: IndexedBrokerEvent = { index: 1, event: {name: "there"} };
		const e3: IndexedBrokerEvent = { index: 2, event: {name: "world"} };
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
		
		const eventsPromise: Promise<IndexedBrokerEvent[]> = new Promise(res => {
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

		const myEvents: IndexedBrokerEvent[] = await eventsPromise;

		expect(myEvents).to.deep.equal([
			{index: 0, event: newSingleEvent(event1)}, 
			{index: 1, event: newSingleEvent(event2)}, 
		]);
	})
})


// export type Event = {
// 	name: string
// }

// describe("able to create a broker", () => {
// 	it("can create a broker given proper input", async () => {
// 		const mb = new MemoryBroker();
// 		const maybeBroker = await mb.newBroker(8080);
// 		switch (maybeBroker.type) {
// 			case MaybeType.Just:
// 				break;
// 			case MaybeType.Nothing:
// 				expect.fail("did not create a broker")
// 				break;
// 		}
// 	})
// })



// describe("check broker signals", () => {
// 	let broker: Broker;
// 	let ws: WebSocket;

// 	before(async () => {
// 		const mb = new MemoryBroker();
// 		const maybeBroker = await mb.newBroker(8081);
// 		switch (maybeBroker.type) {
// 			case MaybeType.Just:
// 				broker = maybeBroker.value;
// 				break;
// 			case MaybeType.Nothing:
// 				expect.fail("Unable to create a web socket server");
// 				break;
// 		}
// 	})

// 	beforeEach((done) => {
// 		ws = new WebSocket("ws://localhost:8081");
// 		ws.on("open", () => {
// 			done()
// 		})		
// 	})

// 	afterEach(() => {
// 		// close_client(client)
// 	})

// 	after(() => {
// 		// close_broker(broker)
// 	})

// 	it("will send an event to a local reciever upon receipt", (done) => {
// 		const event: Event = { name: "hello event" };
		
// 		ws.on("message", (data: string) => {
// 			const myEvent: Event = JSON.parse(data);
// 			expect(myEvent).to.deep.equal(event)
// 			done()
// 		})

// 		ws.send(JSON.stringify(event))
		
// 	})
// })