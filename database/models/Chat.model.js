import {DataTypes, Model} from "sequelize";
import ChatUser from "./ChatUser.model.js";

export default class Chat extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                messengerId: {
                    type: DataTypes.INTEGER,
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