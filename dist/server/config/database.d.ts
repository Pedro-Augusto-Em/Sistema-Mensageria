export declare const databaseConfig: {
    path: string;
    sqlite: {
        foreignKeys: boolean;
        pragma: {
            journal_mode: string;
            synchronous: string;
            cache_size: number;
            temp_store: string;
            mmap_size: number;
            page_size: number;
            auto_vacuum: string;
        };
    };
    backup: {
        enabled: boolean;
        interval: number;
        maxBackups: number;
        backupDir: string;
    };
    migration: {
        enabled: boolean;
        tableName: string;
        directory: string;
    };
    logging: {
        enabled: boolean;
        level: string;
        slowQueryThreshold: number;
    };
    pool: {
        maxConnections: number;
        minConnections: number;
        acquireTimeout: number;
        idleTimeout: number;
    };
};
export declare const getDatabaseConfig: (environment?: string) => {
    path: string;
    sqlite: {
        foreignKeys: boolean;
        pragma: {
            journal_mode: string;
            synchronous: string;
            cache_size: number;
            temp_store: string;
            mmap_size: number;
            page_size: number;
            auto_vacuum: string;
        };
    };
    backup: {
        enabled: boolean;
        interval: number;
        maxBackups: number;
        backupDir: string;
    };
    migration: {
        enabled: boolean;
        tableName: string;
        directory: string;
    };
    logging: {
        enabled: boolean;
        level: string;
        slowQueryThreshold: number;
    };
    pool: {
        maxConnections: number;
        minConnections: number;
        acquireTimeout: number;
        idleTimeout: number;
    };
};
export declare const validateDatabaseConfig: () => {
    path: string;
    sqlite: {
        foreignKeys: boolean;
        pragma: {
            journal_mode: string;
            synchronous: string;
            cache_size: number;
            temp_store: string;
            mmap_size: number;
            page_size: number;
            auto_vacuum: string;
        };
    };
    backup: {
        enabled: boolean;
        interval: number;
        maxBackups: number;
        backupDir: string;
    };
    migration: {
        enabled: boolean;
        tableName: string;
        directory: string;
    };
    logging: {
        enabled: boolean;
        level: string;
        slowQueryThreshold: number;
    };
    pool: {
        maxConnections: number;
        minConnections: number;
        acquireTimeout: number;
        idleTimeout: number;
    };
};
//# sourceMappingURL=database.d.ts.map