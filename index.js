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
    embeds:[embed],
    components:[row]
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

/* ================= KEYWORD ================= */

const keywordCooldown={
  sahur:30*60*1000,
  buka:30*60*1000,
  tarawih:45*60*1000,
  tadarus:50*60*1000,
  sedekah:60*60*1000
};

client.on("messageCreate",async message=>{
  if(message.author.bot) return;
  if(message.channel.id!==process.env.KEYWORD_CHANNEL_ID) return;

  const content=message.content.toLowerCase().trim();
  if(!keywordCooldown[content]) return;

  const user=getUser(message.author.id);
  const now=Date.now();

  if(!user.keywordCooldowns[content]) user.keywordCooldowns[content]=0;

  if(now<user.keywordCooldowns[content]){
    const remain=Math.ceil((user.keywordCooldowns[content]-now)/60000);
    return message.reply(`⏳ Tunggu ${remain} menit lagi.`);
  }

  const reward=Math.floor(Math.random()*20)+10;

  user.points+=reward;
  user.keywordCooldowns[content]=now+keywordCooldown[content];

  saveData();
  await logPoint(message.guild,message.author.id,reward,"Keyword Farm");

  message.channel.send(`✨ +${reward} poin`);
});

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction => {

  if(interaction.isButton()){
    if(!activeQuiz) return interaction.reply({content:"Soal selesai.",ephemeral:true});
    if(activeQuiz.answered.includes(interaction.user.id))
      return interaction.reply({content:"Sudah menjawab.",ephemeral:true});

    activeQuiz.answered.push(interaction.user.id);

    if(parseInt(interaction.customId)===activeQuiz.correct){
      const user=getUser(interaction.user.id);
      user.points+=20;
      saveData();
      await logPoint(interaction.guild,interaction.user.id,20,"Quiz");
      return interaction.reply({content:"🔥 Benar! +20 poin",ephemeral:true});
    }

    return interaction.reply({content:"❌ Salah!",ephemeral:true});
  }

  if(!interaction.isChatInputCommand()) return;

  if(interaction.commandName==="quiz"){
    await interaction.reply({content:"Mengirim soal...",ephemeral:true});
    await sendQuiz();
  }

  if(interaction.commandName==="cooldown"){
    const user=getUser(interaction.user.id);
    const now=Date.now();
    let text="Cooldown:\n";
    for(const key in keywordCooldown){
      const cd=user.keywordCooldowns[key]||0;
      if(now>=cd) text+=`• ${key}: siap\n`;
      else text+=`• ${key}: ${Math.ceil((cd-now)/60000)} menit\n`;
    }
    return interaction.reply({content:text,ephemeral:true});
  }
});

/* ================= READY ================= */

client.once("clientReady", async()=>{
  console.log("BOT ONLINE FULL FIX");

  scheduleDaily();

  const commands=[
    new SlashCommandBuilder().setName("quiz").setDescription("Munculkan quiz"),
    new SlashCommandBuilder().setName("cooldown").setDescription("Cek cooldown")
  ].map(c=>c.toJSON());

  const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id,process.env.GUILD_ID),
    {body:commands}
  );
});

client.login(process.env.TOKEN);