import { Schema, model, models, Document, Types } from "mongoose";

export interface IMessage extends Document {
  order: Types.ObjectId;
  sender: Types.ObjectId;
  senderRole: string;
  senderName: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

export default models.Message || model<IMessage>("Message", MessageSchema);
