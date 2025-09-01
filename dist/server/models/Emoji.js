"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Emoji = void 0;
class Emoji {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.url = data.url;
        this.uploadedBy = data.uploadedBy;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }
    static fromDatabase(data) {
        return new Emoji({
            id: data.id,
            name: data.name,
            url: data.url,
            uploadedBy: data.uploadedBy,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt)
        });
    }
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            url: this.url,
            uploadedBy: this.uploadedBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}
exports.Emoji = Emoji;
//# sourceMappingURL=Emoji.js.map