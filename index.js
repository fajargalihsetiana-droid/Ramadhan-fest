require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");
const fs = require("fs");

/* ================= CONFIG ================= */

const OWNER_ID = process.env.OWNER_ID;

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
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(id) {
  if (!data[id]) data[id] = { points: 0, keywordCooldowns: {} };
  if (!data[id].keywordCooldowns) data[id].keywordCooldowns = {};
  return data[id];
}

/* ================= GAP BALANCING ================= */

function applyGapBalance(userId, baseReward) {

  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points);

  if (sorted.length < 3) return baseReward;

  const firstPoints = sorted[0][1].points;
  const thirdPoints = sorted[2][1].points;

  const gap = firstPoints - thirdPoints;
  const rankIndex = sorted.findIndex(e => e[0] === userId);

  if (gap > 1500) {
    if (rankIndex === 0) return Math.floor(baseReward * 0.6);
    if (rankIndex === 1) return Math.floor(baseReward * 0.75);
    if (rankIndex >= 2 && rankIndex <= 5)
      return Math.floor(baseReward * 1.4);
    if (rankIndex >= 6)
      return Math.floor(baseReward * 1.6);
  }

  if (gap > 800) {
    if (rankIndex === 0) return Math.floor(baseReward * 0.75);
    if (rankIndex === 1) return Math.floor(baseReward * 0.85);
    if (rankIndex >= 2 && rankIndex <= 5)
      return Math.floor(baseReward * 1.2);
  }

  return baseReward;
}

/* ================= LEADERBOARD ================= */

let leaderboardMessage = null;

async function updateLeaderboard(guild) {
  const channel = guild.channels.cache.get(process.env.LEADERBOARD_CHANNEL_ID);
  if (!channel) return;

  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 10);

  if (!sorted.length) return;

  let desc = "";

  sorted.forEach((entry, index) => {
    const medal =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" : `**${index + 1}.**`;

    desc += `${medal} <@${entry[0]}> — **${entry[1].points} poin**\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 RAMADHAN FEST — LIVE LEADERBOARD")
    .setDescription(desc)
    .setColor("Gold")
    .setTimestamp();

  const firstUser = await guild.members.fetch(sorted[0][0]).catch(() => null);
  if (firstUser)
    embed.setThumbnail(firstUser.user.displayAvatarURL({ dynamic: true }));

  if (!leaderboardMessage)
    leaderboardMessage = await channel.send({ embeds: [embed] });
  else
    await leaderboardMessage.edit({ embeds: [embed] });
}

/* ================= HISTORY ================= */

async function logPoint(guild, userId, amount, reason) {
  const channel = guild.channels.cache.get(process.env.HISTORY_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("📜 Update Poin")
    .setDescription(
      `👤 <@${userId}>\n➕ +${amount} poin\n📌 ${reason}`
    )
    .setColor("Gold")
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= KEYWORD FARM ================= */

const keywordCooldown = {
  sahur: 30 * 60 * 1000,
  buka: 30 * 60 * 1000,
  tarawih: 45 * 60 * 1000,
  tadarus: 50 * 60 * 1000,
  sedekah: 60 * 60 * 1000
};

const ramadhanQuotes = [
  "🌙 Ramadhan penuh berkah!",
  "✨ Ibadah kecil, pahala besar!",
  "🤲 Semoga amalmu diterima!",
  "🌟 Terus kumpulkan kebaikan!"
];

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

  let reward = Math.floor(Math.random() * 20) + 10;
  reward = applyGapBalance(message.author.id, reward);

  user.points += reward;
  user.keywordCooldowns[content] = now + keywordCooldown[content];

  saveData();
  await updateLeaderboard(message.guild);
  await logPoint(message.guild, message.author.id, reward, "Keyword Ramadhan");

  const randomQuote = ramadhanQuotes[Math.floor(Math.random()*ramadhanQuotes.length)];

  message.channel.send(
    `${randomQuote}\n\n📈 +${reward} poin\n🏆 Total: **${user.points} poin**`
  );
});

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "cooldown") {
    const user = getUser(interaction.user.id);
    const now = Date.now();
    let text = "⏳ **Status Cooldown:**\n\n";

    for (const key in keywordCooldown) {
      const cd = user.keywordCooldowns[key] || 0;
      if (now >= cd)
        text += `• ${key}: ✅ Siap digunakan\n`;
      else
        text += `• ${key}: ⏱️ ${Math.ceil((cd-now)/60000)} menit lagi\n`;
    }

    return interaction.reply({ content: text, ephemeral: true });
  }

  if (interaction.commandName === "addpoin") {

    if (interaction.user.id !== OWNER_ID)
      return interaction.reply({ content: "❌ Tidak punya akses.", ephemeral: true });

    const target = interaction.options.getUser("user");
    const jumlah = interaction.options.getInteger("jumlah");

    const user = getUser(target.id);
    user.points += jumlah;

    saveData();
    await updateLeaderboard(interaction.guild);
    await logPoint(interaction.guild, target.id, jumlah, "Manual Add");

    return interaction.reply({
      content: `✅ ${jumlah} poin ditambahkan ke ${target.username}`,
      ephemeral: true
    });
  }
});

/* ================= READY ================= */

client.once("clientReady", async () => {
  console.log("BOT ONLINE - GAP BALANCE ACTIVE");

  const commands = [
    new SlashCommandBuilder().setName("cooldown").setDescription("Cek cooldown"),
    new SlashCommandBuilder()
      .setName("addpoin")
      .setDescription("Tambah poin (Owner Only)")
      .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(o=>o.setName("jumlah").setDescription("Jumlah poin").setRequired(true))
  ].map(c=>c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
    { body: commands }
  );
});

client.login(process.env.TOKEN);