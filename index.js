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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

const DATA_FILE = "./data.json";
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

let activeQuiz = null;
let leaderboardMessage = null;

/* ================= BASIC ================= */

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getToday() {
  const now = new Date();
  return new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  )
    .toISOString()
    .split("T")[0];
}

function getUser(id) {
  if (!data[id]) {
    data[id] = {
      points: 0,
      daily: { date: getToday(), earned: 0 },
      keywordCooldowns: {}
    };
  }

  if (!data[id].daily)
    data[id].daily = { date: getToday(), earned: 0 };

  if (!data[id].keywordCooldowns)
    data[id].keywordCooldowns = {};

  if (data[id].daily.date !== getToday()) {
    data[id].daily.date = getToday();
    data[id].daily.earned = 0;
  }

  return data[id];
}

/* ================= LEADERBOARD ================= */

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

    let rankDisplay;
    if (index === 0) rankDisplay = "🥇";
    else if (index === 1) rankDisplay = "🥈";
    else if (index === 2) rankDisplay = "🥉";
    else rankDisplay = `**${index + 1}.**`;

    desc += `${rankDisplay} <@${userId}> — **${points} poin**\n`;
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

/* ================= HISTORY ================= */

async function logPoint(guild, userId, amount) {
  const channel = guild.channels.cache.get(process.env.HISTORY_CHANNEL_ID);
  if (!channel) return;

  const member = await guild.members.fetch(userId);
  const user = getUser(userId);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: member.user.username,
      iconURL: member.user.displayAvatarURL()
    })
    .setTitle("🌙 Update Poin Ramadhan Fest")
    .setDescription(`➕ +${amount} poin\n🏆 Total: ${user.points}`)
    .setColor("Gold")
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= QUIZ ================= */

const questions = [
  { question: "Ibukota Indonesia?", correct: "Jakarta", options: ["Bandung","Jakarta","Medan","Surabaya"] },
  { question: "Jumlah rukun Islam?", correct: "5", options: ["4","5","6","7"] },
  { question: "Planet terbesar?", correct: "Jupiter", options: ["Mars","Venus","Jupiter","Bumi"] },
  { question: "Bulan puasa disebut?", correct: "Ramadhan", options: ["Rajab","Ramadhan","Syawal","Muharram"] },
  { question: "Sholat wajib sehari ada berapa?", correct: "5", options: ["4","5","6","7"] },
  { question: "Lambang negara Indonesia?", correct: "Garuda", options: ["Elang","Garuda","Rajawali","Merpati"] }
];

function shuffle(array){
  for(let i=array.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
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
    content: `<@&${ROLE_ID}> 📢 Quiz baru sudah muncul!`,
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

/* ================= KEYWORD SYSTEM ================= */

const keywordCooldown = {
  sahur: 30*60*1000,
  buka: 30*60*1000,
  tarawih: 45*60*1000,
  tadarus: 50*60*1000,
  sedekah: 60*60*1000
};

function random(min,max){
  return Math.floor(Math.random()*(max-min+1))+min;
}

function calculateKeywordReward(total, key){
  const low = total < 2000;

  if(key==="sedekah") return low? random(35,60):random(15,25);
  if(key==="tarawih"||key==="tadarus") return low? random(25,40):random(10,18);
  return low? random(20,35):random(8,15);
}

const ramadhanTexts=[
"♡ ꒰￤Langkah kecilmu di bulan suci membawa cahaya besar.",
"♡ ꒰￤Doa malam ini terangkat perlahan penuh keberkahan.",
"♡ ꒰￤Ramadhan mengajarkan hati untuk lebih bersyukur.",
"♡ ꒰￤Kebaikan hari ini menjadi cahaya di akhirat.",
"♡ ꒰￤Suasana ibadah membuat jiwa terasa damai."
];

client.on("messageCreate", async message=>{
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

  const reward=calculateKeywordReward(user.points,content);
  user.points+=reward;
  user.keywordCooldowns[content]=now+keywordCooldown[content];

  saveData();
  await logPoint(message.guild,message.author.id,reward);
  await updateLeaderboard(message.guild);

  const text=ramadhanTexts[Math.floor(Math.random()*ramadhanTexts.length)];

  message.channel.send(`${text}

✨ Kamu mendapatkan **+${reward} poin**
🏆 Total poin sekarang: **${user.points}**`);
});

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction=>{

  if(interaction.isButton()){
    if(!activeQuiz)
      return interaction.reply({content:"Soal sudah selesai.",ephemeral:true});

    if(activeQuiz.answered.includes(interaction.user.id))
      return interaction.reply({content:"Kamu sudah menjawab.",ephemeral:true});

    activeQuiz.answered.push(interaction.user.id);

    if(parseInt(interaction.customId)===activeQuiz.correct){
      const user=getUser(interaction.user.id);
      user.points+=20;
      saveData();
      await logPoint(interaction.guild,interaction.user.id,20);
      await updateLeaderboard(interaction.guild);
      return interaction.reply({content:"🔥 Benar! +20 poin",ephemeral:true});
    }

    return interaction.reply({content:"❌ Salah!",ephemeral:true});
  }

  if(interaction.isChatInputCommand()){

    if(interaction.commandName==="quiz"){
      await interaction.reply({content:"⏳ Mengirim soal...",ephemeral:true});
      await sendQuiz();
    }

    if(interaction.commandName==="addpoin"){
      const target=interaction.options.getUser("user");
      const jumlah=interaction.options.getInteger("jumlah");
      const user=getUser(target.id);
      user.points+=jumlah;
      saveData();
      await updateLeaderboard(interaction.guild);
      return interaction.reply({content:"Poin ditambahkan.",ephemeral:true});
    }

    if(interaction.commandName==="cooldown"){
      const user=getUser(interaction.user.id);
      const now=Date.now();
      let text="⏳ Status Cooldown:\n";

      for(const key in keywordCooldown){
        const cd=user.keywordCooldowns[key]||0;
        if(now>=cd) text+=`• ${key} : siap ✅\n`;
        else{
          const min=Math.ceil((cd-now)/60000);
          text+=`• ${key} : ${min} menit\n`;
        }
      }

      return interaction.reply({content:text,ephemeral:true});
    }
  }
});

/* ================= READY ================= */

client.once("clientReady", async()=>{
  console.log("BOT ONLINE");

  const commands=[
    new SlashCommandBuilder().setName("quiz").setDescription("Munculkan soal"),
    new SlashCommandBuilder()
      .setName("addpoin")
      .setDescription("Tambah poin manual")
      .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(o=>o.setName("jumlah").setDescription("Jumlah").setRequired(true)),
    new SlashCommandBuilder()
      .setName("cooldown")
      .setDescription("Cek cooldown keyword")
  ].map(c=>c.toJSON());

  const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id,process.env.GUILD_ID),
    {body:commands}
  );
});

client.login(process.env.TOKEN);