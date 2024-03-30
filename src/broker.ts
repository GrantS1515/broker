import WebSocket, { WebSocketServer } from "ws";
import { Maybe } from "maybe/src/maybe.js";
import { Subject, map, filter } from "rxjs"
import { newMultipleEventsResponse, IndexedEvent, 
	isSingleEvent, isMultipleEventsRequest  
} from "broker-types/broker-types.js"

export type Broker = {
	wss: WebSocketServer,
}

type BrokerEvent = {
	ws: WebSocket,
	message: object,
}

export async function newBroker(port: number, persistence: BrokerPersistance): Promise<Maybe<Broker>> {
	const connection$: Subject<WebSocket> = new Subject();
	const message$: Subject<BrokerEvent> = new Subject();
	const singleEvent$: Subject<BrokerEvent> = new Subject();
	const multipleEventsRequest$: Subject<BrokerEvent>  = new Subject();

	const setupConnection$ = (wss: WebSocketServer) => {
		wss.on("connection", (ws: WebSocket) => {
			connection$.next(ws);
		})
	}

	const sendToAllClients = (wss: WebSocketServer, msg: string) => {
		wss.clients.forEach((client: WebSocket) => {
			if (client.readyState == WebSocket.OPEN) {
				client.send(msg)
			}
		})
	}

	const sendToClient = (ws: WebSocket, msg: string) => {
		ws.send(msg)
	}

	const myPromise: Promise<Maybe<Broker>> = new Promise(res => {
		try {
			const wss = new WebSocketServer({ port: port });
			setupConnection$(wss);
			connection$.subscribe(
				(ws: WebSocket) => {
					ws.on("message", (message: string) => {
						message$.next({ws: ws, message: JSON.parse(message)})
					})
				}
			);
			message$.pipe(
				filter((objEvent: BrokerEvent) => isSingleEvent(objEvent.message))
			).subscribe(
				(brokerSingleEvent: BrokerEvent) => singleEvent$.next(brokerSingleEvent)
			);

			singleEvent$.subscribe(
				(be: BrokerEvent) => {
					persistence.append(be.message);
					sendToAllClients(wss, JSON.stringify(be.message));
			})

			message$.pipe(
				filter((objEvent: BrokerEvent) => isMultipleEventsRequest(objEvent.message))
			).subscribe(
				(objEvent: BrokerEvent) => multipleEventsRequest$.next(objEvent)
			)

			multipleEventsRequest$.pipe(
				map((be: BrokerEvent) => ({ 
					ws: be.ws, 
					message: newMultipleEventsResponse(persistence.getAll())
				})) 
			).subscribe(
				(be: BrokerEvent) => {
					sendToClient(be.ws, JSON.stringify(be.message));
			})

			
			res(Maybe({ wss: wss }))
		} catch {
			res(Maybe<Broker>(undefined))
		}
	})

	return (await myPromise)
	
}

export async function closeBroker(broker: Broker): Promise<void> {

	function closeWSPromise(ws: WebSocket): Promise<void> {
		return new Promise(res => {
				ws.on("close", () => {
					res();
				})
				ws.close()
		})
	}

	const wsClosePromises: Promise<void>[] = [...broker.wss.clients]
		.map((ws: WebSocket) => closeWSPromise(ws))
	
	await Promise.all(wsClosePromises)

	const myPromise: Promise<void> = new Promise(res => {
		broker.wss.close(() => res())
	})

	return (myPromise)
}

interface BrokerPersistance {
	append(event: object): void,
	getAll(): IndexedEvent[],
}

export class BrokerMemory implements BrokerPersistance {
	private list: IndexedEvent[];
	private currentIndex: number;

	constructor() {
		this.list = [];
		this.currentIndex = 0;
	}
	
	append(event: object) {
		const myObj = { index: this.currentIndex, event: event }
		this.list.push(myObj);
		this.currentIndex += 1;
	}

	getAll(): IndexedEvent[] {
		return this.list
	}
}