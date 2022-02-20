import {config} from "dotenv";

config();
const env = process.env.NODE_ENV || 'development';

import EventEmitter from "events";
import {QueryTypes, Sequelize} from "sequelize";
import {Telegraf} from "telegraf";
import dbConfig from "./database/config/config.js";
import {db} from "./database/models/index.js"
import Scenarios, {MENTION, ROULETTE} from "./scenarios.js";
import User from "./database/models/User.model.js";
import Chat from "./database/models/Chat.model.js";
import {random} from "lodash-es";
import Pidor from "./database/models/Pidor.model.js";
import ChatUser from "./database/models/ChatUser.model.js";
import express from "express";

let sequelize = new Sequelize(process.env.DATABASE_URL, dbConfig[env]);

class Server {
    async init() {
        this.eventEmitter = new EventEmitter();
        this.sequelize = sequelize;
        this.models = db;
        this.bot = new Telegraf(process.env.BOT_TOKEN);
        this.scenarios = Scenarios;
        this.http = express();

        this.http.use(this.bot.webhookCallback('/bot'))

        try {
            await this.sequelize.authenticate();
            console.log('Connection has been established successfully.');

            Object.values(this.models)
                .forEach(model => model.init(sequelize));

            Object.values(this.models)
                .filter(model => typeof model.associate === "function")
                .forEach(model => model.associate(this.models));

            await this.sequelize.sync();

            Chat.findAll({plain: false}).then((chats) => {
                chats.forEach((chat) => {
                    this.bot.telegram.getChat(chat.messengerId).then((data) => {
                        Chat.update(
                            {
                                name: data.title
                            },
                            {
                                where: {
                                    messengerId: data.id
                                }
                            }
                        );
                    })
                })
            });
            console.log('Sync success.');
        } catch (error) {
            console.error('Unable to connect to the database:', error);
            process.exit(1);
        }

        this.http.get('/', (req, res) => {
            res.json({status: 'ok'})
        })

        this.eventEmitter.on('addChat', (ctx) => this.createChat(ctx));
        this.eventEmitter.on('sendHelp', (ctx) => this.sendHelpMessage(ctx));
        this.eventEmitter.on('registerPidor', (ctx) => this.registerPidor(ctx));
        this.eventEmitter.on('checkPidor', (ctx) => this.checkPidor(ctx));
        this.eventEmitter.on('getAllStats', (ctx) => this.getAllStats(ctx));
        this.eventEmitter.on('getYearStats', (ctx) => this.getYearStats(ctx));
        this.eventEmitter.on('updateSender', (ctx) => this.updateSender(ctx));
        return this;
    }

    async start() {
        this.bot.start(ctx => {
            ctx.telegram.sendMessage(ctx.chat.id, "Соскучились петушки?");
            this.eventEmitter.emit('addChat', ctx);
        });

        this.bot.help(ctx => {
            this.eventEmitter.emit('sendHelp', ctx)
        })

        this.bot.command("reg", ctx => {
            this.eventEmitter.emit('registerPidor', ctx);
        })

        this.bot.command("pidor", ctx => {
            this.eventEmitter.emit('checkPidor', ctx);
        });

        this.bot.command("pidorall", ctx => {
            this.eventEmitter.emit('getAllStats', ctx);
        });

        this.bot.command("pidorstats", ctx => {
            this.eventEmitter.emit('getYearStats', ctx);
        });

        this.bot.hears(/.*/, ctx => {
            this.eventEmitter.emit('updateSender', ctx);
        });

        await this.http.listen(Number(process.env.PORT),() => {
            console.log(`Express started. Listening on ${process.env.PORT} port`);
        });

        process.once('SIGINT', () => {
            this.bot.stop('SIGINT')
            this.sequelize.close()
        })
        process.once('SIGTERM', () => {
            this.bot.stop('SIGTERM')
            this.sequelize.close()
        })
    }

    async createChat(ctx) {
        return await Chat.findOrCreate({
            where: {
                name: ctx.chat.title,
                messengerId: ctx.chat.id
            },
            defaults: {
                name: ctx.chat.title,
                messengerId: ctx.chat.id
            }
        });
    }

    async registerPidor(ctx) {
        const chat = await Chat.findOne({
            where: {
                messengerId: ctx.chat.id
            }
        });

        const [user, created] = await User.findOrCreate({
            where: {
                messengerId: ctx.message.from.id
            },
            defaults: {
                messengerId: ctx.message.from.id,
                mention: ctx.message.from.username,
                firstName: ctx.message.from.first_name,
                lastName: ctx.message.from.last_name
            },
        });

        if (created) {
            await chat.addUser(user);
        }

        if (!(await chat.hasUser(user))) {
            await chat.addUser(user);
        }

        ctx.reply('Ты был добавлен в мою GAYnote, сладкий');
    }

    resolveUserName(user, silent) {
        if (user.firstName || user.lastName) {
            let name = [];

            if (user.firstName) {
                name.push(user.firstName);
            }

            if (user.lastName) {
                name.push(user.lastName)
            }

            if (silent) {
                return name.join(' ');
            }
            return '<a href="tg://user?id=' + user.messengerId + '">' + name.join(' ') + '</a>';
        } else {
            return (silent ? user.mention : '@' + user.mention);
        }
    }

    resolveScenario(type) {
        return this.scenarios[type][random(0, this.scenarios[type].length - 1, false)];
    }

    startScenario(counter, scenario, ctx, user) {
        let _this = this;
        if (counter < scenario.length) {
            setTimeout(function () {
                let message = scenario[counter].replace(/:username:/g, _this.resolveUserName(user, false));

                ctx.telegram.sendMessage(ctx.chat.id, message, {
                    parse_mode: "HTML"
                }).then(() => {
                    counter++;
                    _this.startScenario(counter, scenario, ctx, user);
                });

            }, random(0, 5, false) * 1000);
        }
    }

    async checkPidor(ctx) {
        let pidor = await Pidor.findOne({
            where: {date: this.sequelize},
            include: [
                {
                    model: User
                },
                {
                    model: Chat,
                    where: {messengerId: ctx.chat.id}
                }
            ]
        })

        if (!pidor) {
            await this.findRandomPidor(ctx);
        } else {
            let messagePlaceholder = this.resolveScenario(MENTION);
            let message = messagePlaceholder.replace(/:username:/g, this.resolveUserName(pidor.User, false));
            await ctx.telegram.sendMessage(pidor.Chat.messengerId, message, {parse_mode: "HTML"});
        }
    }

    async findRandomPidor(ctx) {
        const user = await User.findOne({
            order: this.sequelize.random(),
            include: [{
                model: Chat,
                through: ChatUser,
                where: {messengerId: ctx.chat.id}
            }]
        })

        const commandChat = await Chat.findOne({
            where: {messengerId: ctx.chat.id}
        });

        if (!user || !commandChat) {
            console.log('No pidor')
        } else {
            let scenario = this.resolveScenario(ROULETTE);
            await Pidor.create({
                date: new Date(),
                chatId: commandChat.id,
                userId: user.id
            });
            this.startScenario(0, scenario, ctx, user);
        }
    }

    async getAllStats(ctx) {
        const users = await sequelize.query(
            'SELECT u.id, u.mention, u."firstName", u."lastName", count(p.id) ' +
            'from pidors p ' +
            'inner join users u on u.id = p."userId" ' +
            'inner join chats c on c.id = p."chatId" ' +
            'where c."messengerId" = :chatId ' +
            'group by u.id ' +
            'order by count(p.id) DESC ' +
            'limit 10',
            {
                replacements: {chatId: ctx.chat.id},
                model: User,
                type: QueryTypes.SELECT
            }
        );

        if (users.length > 0) {
            let message = "Топ-10 пидоров за все время:\n\n";
            let index = 1;
            users.forEach(user => {
                console.log(user);
                message = message +
                    index + ". " + this.resolveUserName(user, true) + " — " + user.getDataValue("count") + " раз(а)\n";
                index++;
            });

            if (index === 1) {
                message = message + "Ля, их пока что не было\n";
            }

            message = message +
                "\n" +
                "Всего участников — " + users.length;
            await ctx.telegram.sendMessage(ctx.chat.id, message);
        } else {
            await ctx.telegram.sendMessage(ctx.chat.id, "Ждём участников.");
        }
    }

    async getYearStats(ctx) {
        let year = new Date().getFullYear();

        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);


        const users = await sequelize.query(
            'SELECT u.id, u.mention, u."firstName", u."lastName", count(p.id) ' +
            'from pidors p ' +
            'inner join users u on u.id = p."userId" ' +
            'inner join chats c on c.id = p."chatId" ' +
            'where c."messengerId" = :chatId ' +
            'and p.date between :start and :end ' +
            'group by u.id ' +
            'order by count(p.id) DESC ' +
            'limit 10',
            {
                replacements: {
                    chatId: ctx.chat.id,
                    start: startOfYear.toISOString().split('T')[0],
                    end: endOfYear.toISOString().split('T')[0],
                },
                model: User,
                type: QueryTypes.SELECT
            }
        );


        if (users.length > 0) {
            let message = "Топ-10 пидоров за " + year + " год:\n\n";
            let index = 1;

            users.forEach(user => {
                message = message +
                    index + ". " + this.resolveUserName(user, true) + " — " + user.getDataValue("count") + " раз(а)\n";
                index++;
            });

            if (index === 1) {
                message = message + "Ля, их пока что не было\n";
            }

            message = message +
                "\n" +
                "Всего участников — " + users.length;
            await ctx.telegram.sendMessage(ctx.chat.id, message);
        } else {
            await ctx.telegram.sendMessage(ctx.chat.id, "Ждём участников.");
        }
    }

    async updateSender(ctx) {
        const userData = {
            messengerId: ctx.from.id,
            mention: ctx.from.username,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name
        };

        const chat = await Chat.findOne({where: {messengerId: ctx.chat.id}});

        const [user, created] = await User.findOrCreate({
            where: {messengerId: ctx.from.id},
            defaults: userData
        });

        if (created) {
            await chat.addUser(user);
        }

        if (!(await chat.hasUser(user))) {
            await chat.addUser(chat);
        }

        await user.update(userData);
    }

    async sendHelpMessage(ctx) {
        await ctx.telegram.sendHelpMessage(ctx.chat.id)
    }
}

export default Server;
