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

/* ================= DATA FILE (VOLUME) ================= */

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
    data[id] = {
      points: 0,
      keywordCooldowns: {}
    };
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
      `👤 <@${userId}>\n` +
      `➕ +${amount} poin\n` +
      `📌 Sumber: ${reason}`
    )
    .setColor("Gold")
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= LEADERBOARD ================= */

let leaderboardMessage = null;

async function updateLeaderboard(guild) {
  const channel = guild.channels.cache.get(process.env.LEADERBOARD_CHANNEL_ID);
  if (!channel) return;

  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 10);

  let desc = "";

  sorted.forEach((entry, index) => {
    const userId = entry[0];
    const points = entry[1].points;

    let rank;
    if (index === 0) rank = "🥇";
    else if (index === 1) rank = "🥈";
    else if (index === 2) rank = "🥉";
    else rank = `**${index + 1}.**`;

    desc += `${rank} <@${userId}> — **${points} poin**\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 Leaderboard Ramadhan Fest")
    .setDescription(desc || "Belum ada data.")
    .setColor("Gold")
    .setTimestamp();

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
  { question: "Planet terbesar?", correct: "Jupiter", options: ["Mars","Venus","Jupiter","Bumi"] },
  { question: "Bulan puasa disebut?", correct: "Ramadhan", options: ["Rajab","Ramadhan","Syawal","Muharram"] },
  { question: "Sholat wajib sehari ada berapa?", correct: "5", options: ["4","5","6","7"] },
  { question: "Lambang negara Indonesia?", correct: "Garuda", options: ["Elang","Garuda","Rajawali","Merpati"] }
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
    content:`<@&${ROLE_ID}> 📢 Quiz baru sudah muncul!`,
    embeds:[embed],
    components:[row],
    allowedMentions:{roles:[ROLE_ID]}
  });

  activeQuiz = { correct: correctIndex, answered: [] };

  setTimeout(async ()=>{
    if(!activeQuiz) return;
    await msg.edit({components:[]});
    channel.send("⏰ Waktu habis! Soal hangus.");
    activeQuiz=null;
  },60*60*1000);
}

/* AUTO RANDOM 10x */
function scheduleDaily(){
  for(let i=0;i<10;i++){
    const delay=Math.floor(Math.random()*24*60*60*1000);
    setTimeout(()=>sendQuiz(),delay);
  }
}
setInterval(scheduleDaily,24*60*60*1000);

/* ================= KEYWORD FARM ================= */

const keywordCooldown={
  sahur:30*60*1000,
  buka:30*60*1000,
  tarawih:45*60*1000,
  tadarus:50*60*1000,
  sedekah:60*60*1000
};

function random(min,max){
  return Math.floor(Math.random()*(max-min+1))+min;
}

function calculateReward(totalPoints, keyword){

  const tier1 = totalPoints < 2000;
  const tier2 = totalPoints >= 2000 && totalPoints < 4000;

  function rand(min,max){
    return Math.floor(Math.random()*(max-min+1))+min;
  }

  if(keyword === "sedekah"){
    if(tier1) return rand(30,45);
    if(tier2) return rand(18,25);
    return rand(10,15);
  }

  if(keyword === "tarawih" || keyword === "tadarus"){
    if(tier1) return rand(20,30);
    if(tier2) return rand(10,18);
    return rand(6,10);
  }

  // sahur & buka
  if(tier1) return rand(18,28);
  if(tier2) return rand(8,15);
  return rand(4,8);
}

client.on("messageCreate",async message=>{
  if(message.author.bot) return;
  if(message.channel.id!==process.env.KEYWORD_CHANNEL_ID) return;

  const content=message.content.toLowerCase().trim();
  if(!keywordCooldown[content]) return;

  const user=getUser(message.author.id);
  const now=Date.now();

  if(!user.keywordCooldowns[content])
    user.keywordCooldowns[content]=0;

  if(now<user.keywordCooldowns[content]){
    const remain=Math.ceil((user.keywordCooldowns[content]-now)/60000);
    return message.reply(`⏳ Tunggu ${remain} menit lagi.`);
  }

  const reward = calculateReward(user.points, content);
  user.points+=reward;
  user.keywordCooldowns[content]=now+keywordCooldown[content];

  saveData();
  await updateLeaderboard(message.guild);
  await logPoint(message.guild, message.author.id, reward, "Ramadhan Farm");

  message.channel.send(`✨ Kamu mendapatkan **+${reward} poin**
🏆 Total sekarang: **${user.points}**`);
});

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction => {

  /* BUTTON QUIZ */
  if (interaction.isButton()) {

    if (!activeQuiz)
      return interaction.reply({ content: "Soal sudah selesai.", ephemeral: true });

    if (activeQuiz.answered.includes(interaction.user.id))
      return interaction.reply({ content: "Kamu sudah menjawab.", ephemeral: true });

    activeQuiz.answered.push(interaction.user.id);

    if (parseInt(interaction.customId) === activeQuiz.correct) {

      const user = getUser(interaction.user.id);
      user.points += 20;

      saveData();
      await updateLeaderboard(interaction.guild);
      await logPoint(interaction.guild, interaction.user.id, 20, "Quiz");

      return interaction.reply({
        content: "🔥 Benar! +20 poin",
        ephemeral: true
      });
    }

    return interaction.reply({
      content: "❌ Salah!",
      ephemeral: true
    });
  }

  /* SLASH COMMAND */
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "quiz") {
    await interaction.reply({ content: "⏳ Mengirim soal...", ephemeral: true });
    await sendQuiz();
  }

  if (interaction.commandName === "cooldown") {
    const user = getUser(interaction.user.id);
    const now = Date.now();
    let text = "⏳ Status Cooldown:\n";

    for (const key in keywordCooldown) {
      const cd = user.keywordCooldowns[key] || 0;
      if (now >= cd) text += `• ${key} : siap ✅\n`;
      else {
        const min = Math.ceil((cd - now) / 60000);
        text += `• ${key} : ${min} menit\n`;
      }
    }

    return interaction.reply({ content: text, ephemeral: true });
  }

  if (interaction.commandName === "addpoin") {

    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "❌ Kamu tidak punya akses.",
        ephemeral: true
      });
    }

    const target = interaction.options.getUser("user");
    const jumlah = interaction.options.getInteger("jumlah");

    const user = getUser(target.id);
    user.points += jumlah;

    saveData();
    await updateLeaderboard(interaction.guild);
    await logPoint(interaction.guild, target.id, jumlah, "Manual Add Poin");

    return interaction.reply({
      content: `✅ ${jumlah} poin berhasil ditambahkan ke ${target.username}`,
      ephemeral: true
    });
  }

});

/* ================= READY ================= */

client.once("clientReady", async()=>{
  console.log("BOT ONLINE");
  scheduleDaily();

  const commands=[
    new SlashCommandBuilder().setName("quiz").setDescription("Munculkan soal"),
    new SlashCommandBuilder()
      .setName("cooldown")
      .setDescription("Cek cooldown keyword"),
    new SlashCommandBuilder()
      .setName("addpoin")
      .setDescription("Tambah poin manual (Owner Only)")
      .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(o=>o.setName("jumlah").setDescription("Jumlah poin").setRequired(true))
  ].map(c=>c.toJSON());

  const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id,process.env.GUILD_ID),
    {body:commands}
  );
});

client.login(process.env.TOKEN);