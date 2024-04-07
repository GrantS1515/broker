import WebSocket, { WebSocketServer } from "ws";
import { Maybe } from "maybe";
import { Subject, map, filter } from "rxjs";
import { newMultipleEventsResponse, isSingleEvent, isMultipleEventsRequest } from "broker-types";
export async function newBroker(port, persistence) {
    const connection$ = new Subject();
    const message$ = new Subject();
    const singleEvent$ = new Subject();
    const multipleEventsRequest$ = new Subject();
    const setupConnection$ = (wss) => {
        wss.on("connection", (ws) => {
            connection$.next(ws);
        });
    };
    const sendToAllClients = (wss, msg) => {
        wss.clients.forEach((client) => {
            if (client.readyState == WebSocket.OPEN) {
                client.send(msg);
            }
        });
    };
    const sendToClient = (ws, msg) => {
        ws.send(msg);
    };
    const myPromise = new Promise(res => {
        try {
            const wss = new WebSocketServer({ port: port });
            setupConnection$(wss);
            connection$.subscribe((ws) => {
                ws.on("message", (message) => {
                    message$.next({ ws: ws, message: JSON.parse(message) });
                });
            });
            message$.pipe(filter((objEvent) => isSingleEvent(objEvent.message))).subscribe((brokerSingleEvent) => singleEvent$.next(brokerSingleEvent));
            singleEvent$.subscribe((be) => {
                persistence.append(be.message);
                sendToAllClients(wss, JSON.stringify(be.message));
            });
            message$.pipe(filter((objEvent) => isMultipleEventsRequest(objEvent.message))).subscribe((objEvent) => multipleEventsRequest$.next(objEvent));
            multipleEventsRequest$.pipe(map((be) => ({
                ws: be.ws,
                message: newMultipleEventsResponse(persistence.getAll())
            }))).subscribe((be) => {
                sendToClient(be.ws, JSON.stringify(be.message));
            });
            wss.on("listening", () => {
                res(Maybe({ wss: wss }));
            });
        }
        catch {
            res(Maybe(undefined));
        }
    });
    return (await myPromise);
}
export async function closeBroker(broker) {
    function closeWSPromise(ws) {
        return new Promise(res => {
            ws.on("close", () => {
                res();
            });
            ws.close();
        });
    }
    const wsClosePromises = [...broker.wss.clients]
        .map((ws) => closeWSPromise(ws));
    await Promise.all(wsClosePromises);
    const myPromise = new Promise(res => {
        broker.wss.close(() => res());
    });
    return (myPromise);
}
export class BrokerMemory {
    list;
    currentIndex;
    constructor() {
        this.list = [];
        this.currentIndex = 0;
    }
    append(event) {
        const myObj = { index: this.currentIndex, event: event };
        this.list.push(myObj);
        this.currentIndex += 1;
    }
    getAll() {
        return this.list;
    }
}
