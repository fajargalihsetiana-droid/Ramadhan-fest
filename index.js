require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");
const fs = require("fs");

/* ================= CONFIG ================= */

const ROLE_ID = "1476291125227815210";
const OWNER_ID = "1004034354919506011";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= DATA ================= */

const DATA_FILE = "/data/data.json";

if (!fs.existsSync("/data")) {
  fs.mkdirSync("/data");
}

let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(id) {
  if (!data[id]) {
    data[id] = { points: 0, keywordCooldowns: {} };
  }
  if (!data[id].keywordCooldowns)
    data[id].keywordCooldowns = {};
  return data[id];
}

/* ================= LEADERBOARD ================= */

let lastRanking = [];
let lastZonaPanas = 0;
const ZONA_COOLDOWN = 5 * 60 * 1000;
let leaderboardMessage = null;

async function updateLeaderboard(guild) {
  const channel = guild.channels.cache.get(process.env.LEADERBOARD_CHANNEL_ID);
  if (!channel) return;

  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 10);

  if (!sorted.length) return;

  const currentRanking = sorted.map(e => e[0]);

  /* ===== PERGESERAN RANK ===== */

  if (lastRanking.length > 0) {
    for (const [newIndex, userId] of currentRanking.entries()) {

      const oldIndex = lastRanking.indexOf(userId);

      if (oldIndex !== -1 && oldIndex > newIndex) {

        if (newIndex === 0) {
          const msg = await channel.send(
            `👑🔥 **TAHTA TERGUNCANG!**\n<@${userId}> sekarang memimpin!`
          );
          setTimeout(() => msg.delete().catch(() => {}), 15000);
        } else {
          const shiftMsg = await channel.send(
            `🚀 **RANK NAIK!**\n<@${userId}> naik dari ${oldIndex + 1} ➜ ${newIndex + 1}`
          );
          setTimeout(() => shiftMsg.delete().catch(() => {}), 10000);
        }
      }
    }
  }

  lastRanking = currentRanking;

  /* ===== ZONA PANAS ===== */

  const first = sorted[0];
  const second = sorted[1];

  if (second) {
    const selisih = first[1].points - second[1].points;
    const now = Date.now();

    if (selisih <= 50 && now - lastZonaPanas > ZONA_COOLDOWN) {
      const zonaMsg = await channel.send(
        `⚠️🔥 **ZONA PANAS!**\nSelisih #1 & #2 cuma **${selisih} poin!**`
      );
      setTimeout(() => zonaMsg.delete().catch(() => {}), 20000);
      lastZonaPanas = now;
    }
  }

  /* ===== EMBED ===== */

  let desc = "";
  const firstUser = await guild.members.fetch(first[0]).catch(() => null);
  const selisih = second ? first[1].points - second[1].points : 0;

  desc += `🥇 **CALON JUARA #1**\n`;
  desc += `<@${first[0]}>\n`;
  desc += `📊 **${first[1].points} poin**\n`;
  if (second)
    desc += `📈 Unggul **${selisih} poin** dari posisi 2\n\n`;

  if (second) {
    desc += `🥈 **CALON JUARA #2**\n`;
    desc += `<@${second[0]}>\n`;
    desc += `📊 **${second[1].points} poin**\n`;
    desc += `📉 Tertinggal **${selisih} poin** dari posisi 1\n\n`;
  }

  desc += `━━━━━━━━━━━━━━━━━━\n`;

  sorted.slice(2).forEach((entry, index) => {
    desc += `**${index + 3}.** <@${entry[0]}> — ${entry[1].points} poin\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 RAMADHAN FEST — LIVE RANKING")
    .setDescription("🔥 2 posisi teratas berpeluang juara\n\n" + desc)
    .setColor("Gold")
    .setFooter({ text: "Persaingan makin panas..." })
    .setTimestamp();

  if (firstUser)
    embed.setThumbnail(firstUser.user.displayAvatarURL({ dynamic: true }));

  if (!leaderboardMessage)
    leaderboardMessage = await channel.send({ embeds: [embed] });
  else
    await leaderboardMessage.edit({ embeds: [embed] });
}

/* ================= GAP BALANCING ================= */

function applyBalance(userId, baseReward) {

  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points);

  if (sorted.length < 3) return baseReward;

  const first = sorted[0];
  const third = sorted[2];

  const gap = first[1].points - third[1].points;
  const rankIndex = sorted.findIndex(e => e[0] === userId);

  if (gap > 1200) {
    if (rankIndex === 0) return Math.floor(baseReward * 0.65);
    if (rankIndex >= 2 && rankIndex <= 7)
      return Math.floor(baseReward * 1.2);
  }

  if (gap > 800) {
    if (rankIndex === 0) return Math.floor(baseReward * 0.8);
    if (rankIndex >= 2 && rankIndex <= 5)
      return Math.floor(baseReward * 1.15);
  }

  return baseReward;
}

/* ================= KEYWORD FARM ================= */

const keywordCooldown = {
  sahur: 30 * 60 * 1000,
  buka: 30 * 60 * 1000,
  tarawih: 45 * 60 * 1000,
  tadarus: 50 * 60 * 1000,
  sedekah: 60 * 60 * 1000
};

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateReward(totalPoints, keyword) {
  if (keyword === "sedekah") return random(30, 45);
  if (keyword === "tarawih" || keyword === "tadarus") return random(20, 30);
  return random(18, 28);
}

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (message.channel.id !== process.env.KEYWORD_CHANNEL_ID) return;

  const content = message.content.toLowerCase().trim();
  if (!keywordCooldown[content]) return;

  const user = getUser(message.author.id);
  const now = Date.now();

  if (!user.keywordCooldowns[content])
    user.keywordCooldowns[content] = 0;

  if (now < user.keywordCooldowns[content]) {
    const remain = Math.ceil((user.keywordCooldowns[content] - now) / 60000);
    return message.reply(`⏳ Tunggu ${remain} menit lagi.`);
  }

  let reward = calculateReward(user.points, content);
  reward = applyBalance(message.author.id, reward);

  user.points += reward;
  user.keywordCooldowns[content] = now + keywordCooldown[content];

  saveData();
  await updateLeaderboard(message.guild);

  message.channel.send(
    `✨ Kamu mendapatkan **+${reward} poin**\n🏆 Total sekarang: **${user.points}**`
  );
});

/* ================= READY ================= */

client.once("clientReady", () => {
  console.log("BOT ONLINE - PRODUCTION READY");
});

client.login(process.env.TOKEN);