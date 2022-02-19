import {DataTypes, Model} from "sequelize";
import Chat from "./Chat.model.js";
import User from "./User.model.js";

export default class ChatUser extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                userId: {
                    type: DataTypes.INTEGER,
                    references: {
                        model: User,
                        key: "id"
                    }
                },
                chatId: {
                    type: DataTypes.INTEGER,
                    references: {
                        model: Chat,
                        key: "id"
                    }
                }
            },
            {
                sequelize,
                tableName: "chats_users"
            }
        )
    }
}