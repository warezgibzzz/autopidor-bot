import {DataTypes, Model} from "sequelize";
import ChatUser from "./ChatUser.model.js";

export default class User extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                messengerId: {
                    type: DataTypes.INTEGER,
                    allowNull: false
                },
                mention: {
                    type: DataTypes.STRING
                },
                firstName: {
                    type: DataTypes.STRING
                },
                lastName: {
                    type: DataTypes.STRING
                },
            },
            {
                sequelize,
                tableName: "users"
            }
        );
    }

    static associate(models) {
        this.belongsToMany(models.Chat, {
            through: ChatUser,
            foreignKey: "userId"
        });
        this.hasMany(models.Pidor, {
            foreignKey: "userId"
        });
    }
}