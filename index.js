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

  const first = sorted[0];
  const second = sorted[1];

  let desc = "";

  if (first) {
    desc += `🥇 **CALON JUARA #1**\n`;
    desc += `<@${first[0]}>\n`;
    desc += `📊 **${first[1].points} poin**\n`;

    if (second) {
      const gap = first[1].points - second[1].points;
      desc += `📈 Unggul **${gap} poin** dari posisi 2\n\n`;
    }
  }

  if (second) {
    const gap = first[1].points - second[1].points;
    desc += `🥈 **CALON JUARA #2**\n`;
    desc += `<@${second[0]}>\n`;
    desc += `📊 **${second[1].points} poin**\n`;
    desc += `📉 Tertinggal **${gap} poin** dari posisi 1\n\n`;
  }

  desc += `━━━━━━━━━━━━━━━━━━\n`;

  sorted.slice(2).forEach((entry, index) => {
    desc += `**${index + 3}.** <@${entry[0]}> — ${entry[1].points} poin\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 RAMADHAN FEST — LIVE RANKING")
    .setDescription("🔥 2 posisi teratas berpeluang juara\n\n" + desc)
    .setColor("Gold")
    .setTimestamp();

  const firstUser = await guild.members.fetch(first[0]).catch(() => null);
  if (firstUser)
    embed.setThumbnail(firstUser.user.displayAvatarURL({ dynamic: true }));

  if (!leaderboardMessage)
    leaderboardMessage = await channel.send({ embeds: [embed] });
  else
    await leaderboardMessage.edit({ embeds: [embed] });
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
      `D. ${shuffled[3]}\n\n⏳ 30 menit`
    )
    .setColor("Gold");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("0").setLabel("A").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("1").setLabel("B").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("2").setLabel("C").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("3").setLabel("D").setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({ embeds:[embed], components:[row] });

  activeQuiz = { correct: correctIndex, answered: [] };

  setTimeout(async ()=>{
    if(!activeQuiz) return;
    await msg.edit({components:[]});
    channel.send("⏰ Waktu habis! Soal hangus.");
    activeQuiz=null;
  },30*60*1000);
}

/* RANDOM 12x PER HARI */

function scheduleDaily(){
  for(let i=0;i<12;i++){
    const delay=Math.floor(Math.random()*24*60*60*1000);
    setTimeout(()=>sendQuiz(),delay);
  }
}

setInterval(scheduleDaily,24*60*60*1000);

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction => {

  if(interaction.isButton()){
    if(!activeQuiz) return interaction.reply({content:"Soal selesai.",ephemeral:true});
    if(activeQuiz.answered.includes(interaction.user.id))
      return interaction.reply({content:"Kamu sudah menjawab.",ephemeral:true});

    activeQuiz.answered.push(interaction.user.id);

    if(parseInt(interaction.customId)===activeQuiz.correct){
      const user=getUser(interaction.user.id);
      let reward=Math.floor(Math.random()*3)+10; // 10-12 poin
      reward=applyGapBalance(interaction.user.id,reward);
      user.points+=reward;
      saveData();
      await updateLeaderboard(interaction.guild);
      return interaction.reply({content:`🔥 Benar! +${reward} poin`,ephemeral:true});
    }

    return interaction.reply({content:"❌ Salah!",ephemeral:true});
  }
});

/* ================= READY ================= */

client.once("clientReady", async () => {
  console.log("BOT ONLINE - QUIZ RANDOM ACTIVE");
  scheduleDaily();
});

client.login(process.env.TOKEN);