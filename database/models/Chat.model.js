import Sequelize, {Model} from "sequelize";
import ChatUser from "./ChatUser.model.js";

export default class Chat extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                messengerId: {
                    type: Sequelize.INTEGER,
                    allowNull: false
                }
            },
            {
                sequelize,
                tableName: "chats"
            }
        );
    }

    static associate(models) {
        this.belongsToMany(models.User, {
            through: ChatUser,

        });
        this.hasMany(models.Pidor, {
            foreignKey: "chatId"
        });
    }
}