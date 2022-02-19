import {config} from "dotenv";

config();
const env = process.env.NODE_ENV || 'development';

import EventEmitter from "events";
import {QueryTypes, Sequelize} from "sequelize";
import pkg from "telegraf";

const {Telegraf, Telegram} = pkg;
import commandParts from "telegraf-command-parts";


import dbConfig from "./database/config/config.js";
import {db} from "./database/models/index.js"
import Scenarios, {MENTION, ROULETTE} from "./scenarios.js";
import User from "./database/models/User.model.js";
import Chat from "./database/models/Chat.model.js";
import {random} from "lodash-es";
import Pidor from "./database/models/Pidor.model.js";
import ChatUser from "./database/models/ChatUser.model.js";

let sequelize = new Sequelize(process.env.DATABASE_URL, dbConfig[env]);

class Server {
    async init() {
        this.eventEmitter = new EventEmitter();
        this.sequelize = sequelize;
        this.models = db;
        this.bot = new Telegraf(process.env.BOT_TOKEN);
        this.tg = new Telegram(process.env.BOT_TOKEN);
        this.scenarios = Scenarios;

        this.bot.use(commandParts());

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
                    this.tg.getChat(chat.messengerId).then((data) => {
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

        this.eventEmitter.on('addChat', (chat) => this.createChat(chat));
        this.eventEmitter.on('registerPidor', (ctx) => this.registerPidor(ctx));
        this.eventEmitter.on('checkPidor', (chat) => this.checkPidor(chat));
        this.eventEmitter.on('getAllStats', (chat) => this.getAllStats(chat));
        this.eventEmitter.on('getYearStats', (ctx) => this.getYearStats(ctx));
        this.eventEmitter.on('updateSender', (ctx) => this.updateSender(ctx));
        return this;
    }

    async start() {
        this.bot.command("start", ctx => {
            this.tg.sendMessage(ctx.chat.id, "Соскучились петушки?");
            this.eventEmitter.emit('addChat', ctx.chat);
        });

        this.bot.command("reg", ctx => {
            this.eventEmitter.emit('registerPidor', ctx);
        })

        this.bot.command("pidor", ctx => {
            this.eventEmitter.emit('checkPidor', ctx.chat);
        });

        this.bot.command("pidorall", ctx => {
            this.eventEmitter.emit('getAllStats', ctx.chat);
        });

        this.bot.command("pidorstats", ctx => {
            this.eventEmitter.emit('getYearStats', ctx);
        });

        this.bot.hears(/.*/, ctx => {
            this.eventEmitter.emit('updateSender', ctx);
        });

        await this.bot.launch();
    }

    async createChat(chat) {
        return await Chat.findOrCreate({
            where: {
                name: chat.title,
                messengerId: chat.id
            },
            defaults: {
                name: chat.title,
                messengerId: chat.id
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

    startScenario(counter, scenario, chat, user) {
        let _this = this;
        if (counter < scenario.length) {
            setTimeout(function () {
                let message = scenario[counter].replace(/:username:/g, _this.resolveUserName(user, false));

                _this.tg.sendMessage(chat, message, {
                    parse_mode: "HTML"
                }).then(() => {
                    counter++;
                    _this.startScenario(counter, scenario, chat, user);
                });

            }, random(0, 5, false) * 1000);
        }
    }

    async checkPidor(chat) {
        let pidor = await Pidor.findOne({
            where: {date: this.sequelize},
            include: [
                {
                    model: User
                },
                {
                    model: Chat,
                    where: {messengerId: chat.id}
                }
            ]
        })

        if (!pidor) {
            await this.findRandomPidor(chat);
        } else {
            let messagePlaceholder = this.resolveScenario(MENTION);
            let message = messagePlaceholder.replace(/:username:/g, this.resolveUserName(pidor.User, false));
            await this.tg.sendMessage(pidor.Chat.messengerId, message, {parse_mode: "HTML"});
        }
    }

    async findRandomPidor(chat) {
        const user = await User.findOne({
            order: this.sequelize.random(),
            include: [{
                model: Chat,
                through: ChatUser,
                where: {messengerId: chat.id}
            }]
        })

        const commandChat = await Chat.findOne({
            where: {messengerId: chat.id}
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
            this.startScenario(0, scenario, chat.id, user);
        }
    }

    async getAllStats(chat) {
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
                replacements: {chatId: chat.id},
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
                    index + ". " + this.resolveUserName(user, true) + " — " + user.dataValues.count + " раз(а)\n";
                index++;
            });

            if (index === 1) {
                message = message + "Ля, их пока что не было\n";
            }

            message = message +
                "\n" +
                "Всего участников — " + users.length;
            this.tg.sendMessage(chat.id, message);
        } else {
            this.tg.sendMessage(chat.id, "Ждём участников.");
        }
    }

    async getYearStats(ctx) {
        let year = new Date().getFullYear();
        if (ctx.state.command.splitArgs.length === 1 && ctx.state.command.args.length > 0) {
            year = parseInt(ctx.state.command.splitArgs[0]);
        }

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
                    index + ". " + this.resolveUserName(user, true) + " — " + user.dataValues.count + " раз(а)\n";
                index++;
            });

            if (index === 1) {
                message = message + "Ля, их пока что не было\n";
            }

            message = message +
                "\n" +
                "Всего участников — " + users.length;
            this.tg.sendMessage(ctx.chat.id, message);
        } else {
            this.tg.sendMessage(ctx.chat.id, "Ждём участников.");
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
}

export default Server;
