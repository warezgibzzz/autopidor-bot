import {DataTypes, Model} from "sequelize";
import ChatUser from "./ChatUser.model.js";

/**
 * @property {Function} addUser add user to chat
 * @property {Function} hasUser check if user belongs to chat
 * @property {Function} getUsers get all chat users collection
 * @property {Function} setUsers set chat users collection
 *
 */
export default class Chat extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                messengerId: {
                    type: DataTypes.BIGINT,
                    allowNull: false
                },
                name: {
                    type: DataTypes.STRING
                },
                timezone: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: 'UTC'
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
            foreignKey: "chatId"

        });
        this.hasMany(models.Pidor, {
            foreignKey: "chatId"
        });
    }
}