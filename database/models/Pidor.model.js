import {DataTypes, Model} from "sequelize";

export default class Pidor extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {},
            {
                sequelize,
                tableName: "pidors"
            }
        );
    }

    static associate(models) {
        this.belongsTo(models.User);
        this.belongsTo(models.Chat);
    }
}