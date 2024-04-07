import { WebSocketServer } from "ws";
import { Maybe } from "maybe";
import { IndexedEvent } from "broker-types";
export type Broker = {
    wss: WebSocketServer;
};
export declare function newBroker(port: number, persistence: BrokerPersistance): Promise<Maybe<Broker>>;
export declare function closeBroker(broker: Broker): Promise<void>;
interface BrokerPersistance {
    append(event: object): void;
    getAll(): IndexedEvent[];
}
export declare class BrokerMemory implements BrokerPersistance {
    private list;
    private currentIndex;
    constructor();
    append(event: object): void;
    getAll(): IndexedEvent[];
}
export {};
