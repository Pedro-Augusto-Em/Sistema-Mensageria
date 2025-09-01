export interface IEmoji {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Emoji implements IEmoji {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: IEmoji) {
    this.id = data.id;
    this.name = data.name;
    this.url = data.url;
    this.uploadedBy = data.uploadedBy;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static fromDatabase(data: any): Emoji {
    return new Emoji({
      id: data.id,
      name: data.name,
      url: data.url,
      uploadedBy: data.uploadedBy,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    });
  }

  toJSON(): IEmoji {
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
