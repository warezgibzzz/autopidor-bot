import Sequelize, {Model} from "sequelize";
import Chat from "./Chat.model.js";
import User from "./User.model.js";

export default class ChatUser extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                userId: {
                    type: Sequelize.INTEGER,
                    references: {
                        model: User,
                        key: "id"
                    }
                },
                chatId: {
                    type: Sequelize.INTEGER,
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