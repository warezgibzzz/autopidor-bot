import {DataTypes, Model} from "sequelize";

export default class Pidor extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                date: {
                    type: DataTypes.DATEONLY
                }
            },
            {
                sequelize,
                tableName: "pidors"
            }
        );
    }

    static associate(models) {
        this.belongsTo(models.User, {
            foreignKey: "userId"
        });
        this.belongsTo(models.Chat, {
            foreignKey: "chatId"
        });
    }
}