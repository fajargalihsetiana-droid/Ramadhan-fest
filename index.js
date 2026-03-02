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

  let desc = "";
  const firstUser = await guild.members.fetch(first[0]).catch(() => null);
  const selisih = second ? first[1].points - second[1].points : 0;

  desc += `🥇 **CALON JUARA #1**\n<@${first[0]}>\n📊 ${first[1].points} poin\n\n`;
  if (second)
    desc += `🥈 **CALON JUARA #2**\n<@${second[0]}>\n📊 ${second[1].points} poin\n\n`;

  desc += `━━━━━━━━━━━━━━━━━━\n`;

  sorted.slice(2).forEach((entry, index) => {
    desc += `**${index + 3}.** <@${entry[0]}> — ${entry[1].points} poin\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 RAMADHAN FEST — LIVE RANKING")
    .setDescription(desc)
    .setColor("Gold")
    .setTimestamp();

  if (firstUser)
    embed.setThumbnail(firstUser.user.displayAvatarURL({ dynamic: true }));

  if (!leaderboardMessage)
    leaderboardMessage = await channel.send({ embeds: [embed] });
  else
    await leaderboardMessage.edit({ embeds: [embed] });
}

/* ================= GAP BALANCE ================= */

function applyBalance(userId, baseReward) {
  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points);

  if (sorted.length < 3) return baseReward;

  const gap = sorted[0][1].points - sorted[2][1].points;
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

/* ================= QUIZ ================= */

let activeQuiz = null;

const questions = [
  { question: "Ibukota Indonesia?", correct: "Jakarta", options: ["Bandung","Jakarta","Medan","Surabaya"] },
  { question: "Jumlah rukun Islam?", correct: "5", options: ["4","5","6","7"] },
  { question: "Planet terbesar?", correct: "Jupiter", options: ["Mars","Venus","Jupiter","Bumi"] }
];

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

async function sendQuiz(){
  if(activeQuiz) return;

  const channel = client.channels.cache.get(process.env.QUIZ_CHANNEL_ID);
  if(!channel) return;

  const q = questions[Math.floor(Math.random()*questions.length)];
  const shuffled = shuffle([...q.options]);
  const correctIndex = shuffled.indexOf(q.correct);

  const embed = new EmbedBuilder()
    .setTitle("🌙 QUIZ RAMADHAN FEST")
    .setDescription(
      `**${q.question}**\n\n`+
      `A. ${shuffled[0]}\n`+
      `B. ${shuffled[1]}\n`+
      `C. ${shuffled[2]}\n`+
      `D. ${shuffled[3]}\n\n⏳ 1 jam`
    )
    .setColor("Gold");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("0").setLabel("A").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("1").setLabel("B").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("2").setLabel("C").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("3").setLabel("D").setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({
    content:`<@&${ROLE_ID}> 📢 Quiz baru muncul!`,
    embeds:[embed],
    components:[row],
    allowedMentions:{roles:[ROLE_ID]}
  });

  activeQuiz = { correct: correctIndex, answered: [] };

  setTimeout(async ()=>{
    if(!activeQuiz) return;
    await msg.edit({components:[]});
    channel.send("⏰ Waktu habis!");
    activeQuiz=null;
  },60*60*1000);
}

/* RANDOM 10x PER HARI */
function scheduleDaily(){
  for(let i=0;i<10;i++){
    const delay=Math.floor(Math.random()*24*60*60*1000);
    setTimeout(()=>sendQuiz(),delay);
  }
}
setInterval(scheduleDaily,24*60*60*1000);

/* ================= READY ================= */

client.once("clientReady", async()=>{
  console.log("BOT ONLINE - FULL SYSTEM");
  scheduleDaily();
});

client.login(process.env.TOKEN);