import {config} from "dotenv";

config();

export default {
    development: {
        url: process.env.DATABASE_URL,
        dialect: "postgres",
        dialectOptions: {
            ssl: {
                mode: "require",
                rejectUnauthorized: false
            }
        }
    },
    production: {
        url: process.env.DATABASE_URL,
        dialect: "postgres",
        dialectOptions: {
            ssl: {
                mode: "require",
                rejectUnauthorized: false
            }
        }
    }
}
