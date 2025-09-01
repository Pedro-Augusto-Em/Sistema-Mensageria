import sqlite3 from 'sqlite3';
export declare class Database {
    private db;
    private static instance;
    private constructor();
    static getInstance(): Database;
    getDatabase(): sqlite3.Database;
    run(sql: string, params?: any[]): Promise<sqlite3.RunResult>;
    get(sql: string, params?: any[]): Promise<any>;
    all(sql: string, params?: any[]): Promise<any[]>;
    close(): Promise<void>;
}
export declare function initializeDatabase(): Promise<void>;
export declare function getDatabase(): Database;
//# sourceMappingURL=database.d.ts.map