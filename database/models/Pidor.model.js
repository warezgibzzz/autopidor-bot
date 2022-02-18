import Sequelize, {Model} from "sequelize";

export default class Pidor extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                date: {
                    type: Sequelize.DATEONLY,
                    allowNull: false
                }
            },
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