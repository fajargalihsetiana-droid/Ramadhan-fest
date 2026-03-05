const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle} = require("discord.js")

module.exports = (client)=>{

let kerjaCooldown={}

/* panel kerja */

async function sendKerjaPanel(guild){

const channel=guild.channels.cache.get(process.env.KERJA_CHANNEL_ID)
if(!channel) return

const embed=new EmbedBuilder()

.setTitle("🧹 KERJA RAMADHAN")

.setDescription(`
Rank #3 ke bawah bisa bekerja.

💰 Reward
80 - 180 poin

⏳ Cooldown
45 menit
`)

.setColor("Green")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("kerja")
.setLabel("🧹 Kerja")
.setStyle(ButtonStyle.Success)

)

channel.send({
embeds:[embed],
components:[row]
})

}

/* tombol kerja */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return
if(interaction.customId!=="kerja") return

const now=Date.now()

if(kerjaCooldown[interaction.user.id] && now<kerjaCooldown[interaction.user.id]){

const wait=Math.ceil((kerjaCooldown[interaction.user.id]-now)/60000)

return interaction.reply({
content:`⏳ Tunggu ${wait} menit sebelum kerja lagi.`,
ephemeral:true
})

}

/* cek ranking */

const sorted=Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

const rankIndex=sorted.findIndex(e=>e[0]===interaction.user.id)

if(rankIndex===0 || rankIndex===1){

return interaction.reply({
content:"⚠️ Rank #1 dan #2 tidak boleh kerja.",
ephemeral:true
})

}

/* reward */

const reward=Math.floor(Math.random()*100)+80

const user=getUser(interaction.user.id)

user.points+=reward

saveData()

await updateLeaderboard(interaction.guild)

kerjaCooldown[interaction.user.id]=Date.now()+2700000

interaction.reply({
content:`🧹 Kerja selesai!\n💰 +${reward} poin\n🏆 Total: ${user.points}`
})

})

/* kirim panel saat bot online */

client.once("clientReady",()=>{

const guild=client.guilds.cache.get(process.env.GUILD_ID)

if(guild){
sendKerjaPanel(guild)
}

})

}