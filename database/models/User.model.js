import Sequelize, {Model} from "sequelize";
import ChatUser from "./ChatUser.model.js";

export default class User extends Model {
    static init(sequelize, DataType) {
        return super.init(
            {
                messengerId: {
                    type: Sequelize.INTEGER,
                    allowNull: false
                },
                mention: {
                    type: Sequelize.STRING
                },
                name: {
                    type: Sequelize.STRING
                }
            },
            {
                sequelize,
                tableName: "users"
            }
        );
    }

    static associate(models) {
        this.belongsToMany(models.Chat, {
            through: ChatUser
        });
        this.hasMany(models.Pidor, {
            foreignKey: "userId"
        });
    }
}