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

/* ================= HISTORY ================= */

async function logPoint(guild, userId, amount, reason) {
  const channel = guild.channels.cache.get(process.env.HISTORY_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("📜 Update Poin Ramadhan Fest")
    .setDescription(
      `👤 <@${userId}>\n➕ +${amount} poin\n📌 Sumber: ${reason}`
    )
    .setColor("Gold")
    .setTimestamp();

  channel.send({ embeds: [embed] });
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
            `👑🔥 **PUNCAK BERGESER!**\n<@${userId}> kini memimpin leaderboard!`
          );

          setTimeout(() => msg.delete().catch(() => {}), 15000);

        } else {

          const shiftMsg = await channel.send(
            `🚀 **RANK NAIK!**\n<@${userId}> naik dari posisi ${oldIndex + 1} ➜ ${newIndex + 1}`
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
        `⚔️🔥 **PERSAINGAN MEMANAS!**\nRank #1 & #2 beda ${selisih} poin!`
      );

      setTimeout(() => zonaMsg.delete().catch(() => {}), 20000);
      lastZonaPanas = now;
    }
  }

  /* ===== EMBED ===== */

  let desc = "";

  const firstUser = await guild.members.fetch(first[0]).catch(() => null);
  const selisih = second ? first[1].points - second[1].points : 0;

  desc += `🥇 **CALON JUARA #1**\n<@${first[0]}>\n📊 ${first[1].points} poin\n`;
  if (second)
    desc += `📈 Unggul ${selisih} poin\n\n`;

  if (second) {
    desc += `🥈 **CALON JUARA #2**\n<@${second[0]}>\n📊 ${second[1].points} poin\n`;
    desc += `📉 Tertinggal ${selisih} poin\n\n`;
  }

  desc += `━━━━━━━━━━━━━━━━━━\n`;

  sorted.slice(2).forEach((entry, index) => {
    desc += `${index + 3}. <@${entry[0]}> — ${entry[1].points} poin\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 RAMADHAN FEST — LIVE RANKING")
    .setDescription("🔥 2 posisi teratas berpeluang juara\n\n" + desc)
    .setColor("Gold")
    .setTimestamp();

  if (firstUser)
    embed.setThumbnail(firstUser.user.displayAvatarURL({ dynamic: true }));

  if (!leaderboardMessage)
    leaderboardMessage = await channel.send({ embeds: [embed] });
  else
    await leaderboardMessage.edit({ embeds: [embed] });
}

/* ================= GAP SYSTEM ================= */

function applyBalance(userId, baseReward) {

  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points);

  if (sorted.length < 5) return baseReward;

  const topFive = sorted.slice(0, 5);
  const avg = topFive.reduce((s, e) => s + e[1].points, 0) / 5;

  const firstPoints = sorted[0][1].points;
  const gap = firstPoints - avg;

  const rankIndex = sorted.findIndex(e => e[0] === userId);

  const ramadhanStart = new Date("2026-02-18");
  const lebaran = new Date("2026-03-20");
  const progress = Math.min(Math.max((Date.now() - ramadhanStart) / (lebaran - ramadhanStart), 0), 1);

  const ketat = 1100 - (progress * 300);
  const ringan = 700 - (progress * 200);

  if (gap > ketat) {
    if (rankIndex === 0) return Math.floor(baseReward * (0.8 - progress * 0.1));
    if (rankIndex <= 5) return Math.floor(baseReward * (1.1 + progress * 0.1));
  }

  if (gap > ringan) {
    if (rankIndex === 0) return Math.floor(baseReward * 0.9);
    if (rankIndex <= 5) return Math.floor(baseReward * 1.08);
  }

  return baseReward;
}

/* ================= READY ================= */

client.once("clientReady", async () => {
  console.log("BOT ONLINE");
});

client.login(process.env.TOKEN);