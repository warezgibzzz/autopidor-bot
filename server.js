// server.js
// where your node app starts
require('dotenv').config();
// init project
let express = require("express");
let Sequelize = require("sequelize");
let app = express();

const _ = require("lodash");
const Telegraf = require("telegraf");
const Telegram = require("telegraf/telegram");
const commandParts = require("telegraf-command-parts");

const bot = new Telegraf(process.env.BOT_TOKEN);
const tg = new Telegram(process.env.BOT_TOKEN);

bot.use(commandParts());
app.use(express.static(".data"));

let User, Pidor;
let Chats = [];

// setup a new database
// using database credentials set in .env
let sequelize = new Sequelize(
    "database",
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: "0.0.0.0",
        dialect: "sqlite",
        pool: {
            max: 5,
            min: 0,
            idle: 10000
        },
        // Security note: the database is saved to the file `database.sqlite` on the local filesystem. It"s deliberately placed in the `.data` directory
        // which doesn"t get copied if someone remixes the project.
        storage: ".data/database.sqlite"
    }
);


const pidorScenario = [
    [
        "Погодите-ка, сначала нужно спасти остров!",
        "<i>4 8 15 16 23 42</i>",
        "108:00 <i>Успели...</i>",
        "Остров спасли? Спасли. И пидора короновать не забудем.",
        "Наш пидор это... :username:! Ура, пидор!"
    ],
    [
        "Начнем наш ежедневный розыгрыш!",
        "Крутим барабан, господа!",
        "Достаем номер... Итак...",
        "Наш пидор на следующие 24 часа теперь участник...",
        "... ... :username:! Поздравляем :username: с этим СОБЫТИЕМ!"
    ],
    [
        "Чо чо? Хотите пидора? <i>Сейчас я вам найду</i> пидора...",
        "<i>Ох ты...</i>",
        "ЭТОГО НИКТО НЕ ОЖИДАЛ!",
        "Вы готовы?",
        "Теперь наш пидор - :username:!",
        "<i>Охуеть, да?</i>"
    ],
    [
        "ТЕПЕРЬ ЭТО НЕ ОСТАНОВИТЬ!",
        "<i>Шаманим-шаманим...</i>",
        "Доступ получен. Анн<b>а</b>лирование протокола.",
        "TI PIDOR, :username:"
    ],
    [
        "Осторожно! <b>Пидор дня</b> активирован!",
        "Сканирую...",
        "КЕК",
        "Стоять! Не двигаться! Вы объявлены <b>пидором дня</b>, :username:"
    ],
    [
        "Сейчас поколдуем...",
        "<i>Хм...</i>",
        "Так-так, что же тут у нас...",
        "Ого, вы посмотрите только! А пидор дня то - :username:"
    ]
];

// authenticate with the database
sequelize
    .authenticate()
    .then(function (err) {
        console.log("Connection has been established successfully.");
        // define a new table "users"
        User = sequelize.define("users", {
            userId: {
                type: Sequelize.INTEGER
            },
            chatId: {
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING
            },
            fullName: {
                type: Sequelize.STRING
            }
        });
        Pidor = sequelize.define("pidors", {
            user_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: User,
                    key: "id"
                }
            },
            date: {
                type: Sequelize.DATEONLY
            }
        });
        User.hasMany(Pidor, {foreignKey: "user_id", sourceKey: "id"});
        Pidor.belongsTo(User, {
            foreignKey: "user_id",
            targetKey: "id"
        });
        setup();
    })
    .catch(function (err) {
        console.log("Unable to connect to the database: ", err);
    });

// populate table with default users
function setup() {
    User.sync();
    Pidor.sync();

    User.aggregate("chatId", "DISTINCT", {plain: false}).then((chats) => {
        chats.forEach((chat) => {
            tg.getChat(chat.DISTINCT).then((data) => {
                Chats.push({
                    id: data.id,
                    title: data.title
                })
            })
        })
    });
}

function resolveUserName(user, silent) {

    if (user.fullName) {
        if (silent) {
            return user.fullName;
        }
        return '<a href="tg://user?id=' + user.userId + '">' + user.fullName + '</a>';
    } else {
        return (silent ? user.name : '@' + user.name);
    }
}

function getRandPidorScenario() {
    return pidorScenario[Math.floor(Math.random() * Math.floor(pidorScenario.length))];
}

function startScenario(counter, scenario, user) {
    if (counter < scenario.length) {
        setTimeout(function () {
            let message = scenario[counter].replace(/:username:/g, resolveUserName(user, false));

            tg.sendMessage(user.chatId, message, {parse_mode: "html"});

            counter++;
            startScenario(counter, scenario, user);
        }, (_.random(1, 5, false) * 1000));
    }
}

function checkPidor(chat) {
    Pidor.findOne({
        where: {date: new Date()},
        include: [{
            model: User,
            as: "user",
            where: {chatId: chat}
        }]
    }).then(pidor => {
        if (null === pidor) {
            detectPidor(chat);
        } else {
            let messagePlaceholder = "Согласно моим источникам, сегодняшний <i>пидор</i> дня у нас <b>:username:</b>!";
            let message = messagePlaceholder.replace(/:username:/g, resolveUserName(pidor.user, false));
            tg.sendMessage(pidor.user.chatId, message, {parse_mode: "html"});
        }
    });
}

function detectPidor(chat) {
    let scenario = getRandPidorScenario();

    User.findOne({
        where: {chatId: chat},
        order: Sequelize.literal("random()")
    }).then((user) => {
        if (!user) {
            console.log('No pidor')
        } else {
            Pidor.create({user_id: user.id, date: new Date()});
            startScenario(0, scenario, user);
        }
    });
}

bot.command("pidor", (ctx) => {
    checkPidor(ctx.chat.id);
})

bot.command("pidorall", (ctx) => {
    User.findAll({
        where: {chatId: ctx.chat.id},
        include: [{
            model: Pidor,
            as: "pidors"
        }]
    }).then(users => {
        if (users.length > 0) {
            let message = "Топ-10 пидоров за все время:\n\n";
            let index = 1;
            users.sort((a, b) => {
                if (a.pidors.length > b.pidors.length) {
                    return -1;
                } else {
                    return 1;
                }
                return 0;
            })
            users.forEach(user => {
                if (user.pidors.length > 0) {
                    message = message +
                        index + ". " + resolveUserName(user, true) + " — " + user.pidors.length + " раз(а)\n";
                    index++;
                }
            });

            if (index === 1) {
                message = message + "Ля, их пока что не было\n";
            }

            message = message +
                "\n" +
                "Всего участников — " + users.length;
            tg.sendMessage(ctx.chat.id, message);
        } else {
            tg.sendMessage(ctx.chat.id, "Ждём участников.");
        }
    })
});

bot.command("pidorstats", (ctx) => {
    console.log(ctx.state.command);

    let year = new Date().getFullYear();
    if (ctx.state.command.splitArgs.length === 1 && ctx.state.command.args.length > 0) {
        year = ctx.state.command.splitArgs[0];
    }

    let startOfYear = new Date(year, 0, 1);
    let endOfYear = new Date(year, 11, 31);


    User.findAll({
        where: {
            chatId: ctx.chat.id,
        },
        include: [{
            model: Pidor,
            as: "pidors",
            where: {
                date: {
                    [Sequelize.Op.between]: [startOfYear, endOfYear]
                }
            }
        }]
    }).then(users => {

        if (users.length > 0) {
            let message = "Топ-10 пидоров за " + year + " год:\n\n";
            let index = 1;
            users.sort((a, b) => {
                console.log(a.pidors.length, b.pidors.length)
                if (a.pidors.length > b.pidors.length) {
                    return -1;
                } else {
                    return 1;
                }
                return 0;
            })
            users.forEach(user => {
                if (user.pidors.length > 0) {
                    message = message +
                        index + ". " + resolveUserName(user, true) + " — " + user.pidors.length + " раз(а)\n";
                    index++;
                }
            });

            if (index === 1) {
                message = message + "Ля, их пока что не было\n";
            }

            message = message +
                "\n" +
                "Всего участников — " + users.length;
            tg.sendMessage(ctx.chat.id, message);
        } else {
            tg.sendMessage(ctx.chat.id, "Ждём участников.");
        }
    })
});


bot.hears(/.*/, ctx => {
    let userData = {
        userId: ctx.from.id,
        chatId: ctx.chat.id,
        name: ctx.from.username,
        fullName: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '')
    };
    User.findOne({where: {userId: ctx.from.id, chatId: ctx.chat.id}}).then(user => {
        if (!user) {
            User.create(userData);
        } else {
            user.update({
                name: ctx.from.username,
                fullName: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '')
            });
        }
    });
});

bot.launch().then(function () {
    app.get("/run-pidor", function (request, response) {
        checkPidor(request.query.chat);
        response.send('OK pidor');
    });

    app.get("/chats", function (request, response) {
        response.json(Chats);
    });

    let listener = app.listen(process.env.PORT || '3000', function () {
        console.log("Your app is listening on port " + listener.address().port);
    });
});
