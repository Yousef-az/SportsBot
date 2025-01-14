const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const schedule = require('node-schedule');
require('dotenv').config();

// Create the bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Debugging: Log a message when the bot starts
console.log("Starting bot...");

// Function to fetch Soccer Matches
async function fetchSoccerMatches() {
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    try {
        const response = await axios.get('https://api.football-data.org/v4/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_KEY },
        });

        return response.data.matches.map((match) => ({
            sport: 'Soccer',
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            time: new Date(match.utcDate),
        }));
    } catch (error) {
        console.error('Error fetching soccer matches:', error.message);
        return [];
    }
}

// Function to fetch NFL Matches
async function fetchNFLMatches(season = '2025', week = '1', type = 'REG') {
    const AMERICAN_FOOTBALL_API_KEY = process.env.AMERICAN_FOOTBALL_API_KEY;
    try {
        const response = await axios.get(
            `https://api.sportsradar.com/nfl/official/trial/v7/en/games/${season}/${type}/${week}/schedule.json`,
            { params: { api_key: AMERICAN_FOOTBALL_API_KEY } }
        );

        return response.data.games.map((game) => ({
            sport: 'American Football',
            homeTeam: game.home.name,
            awayTeam: game.away.name,
            time: new Date(game.scheduled),
        }));
    } catch (error) {
        console.error('Error fetching NFL matches:', error.message);
        return [];
    }
}

// Function to fetch Standings for Soccer and NFL
async function fetchStandings(sport, leagueId) {
    try {
        if (sport === 'Soccer') {
            const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
            const response = await axios.get(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, {
                headers: { 'X-Auth-Token': FOOTBALL_API_KEY },
            });
            return response.data.standings[0].table.map(
                (team) => `${team.position}. ${team.team.name} - ${team.points} pts`
            );
        } else if (sport === 'NFL') {
            const AMERICAN_FOOTBALL_API_KEY = process.env.AMERICAN_FOOTBALL_API_KEY;
            const response = await axios.get(
                `https://api.sportsradar.com/nfl/official/trial/v7/en/seasons/2025/REG/standings.json`,
                { params: { api_key: AMERICAN_FOOTBALL_API_KEY } }
            );
            return response.data.conferences.flatMap((conference) =>
                conference.divisions.map(
                    (division) =>
                        `🏈 **${division.name}**\n` +
                        division.teams
                            .map((team) => `${team.market} ${team.name} - ${team.wins}-${team.losses}`)
                            .join('\n')
                )
            );
        }
    } catch (error) {
        console.error(`Error fetching standings for ${sport}:`, error.message);
        return [];
    }
}

// Function to fetch Player Stats
async function fetchPlayerStats(playerName, sport) {
    try {
        if (sport === 'Soccer') {
            const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
            const response = await axios.get(
                `https://api.football-data.org/v4/players/${playerName}`,
                { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
            );
            const player = response.data;
            return `⚽ **Player Stats for ${player.name}**\nGoals: ${player.goals}\nAssists: ${player.assists}`;
        } else if (sport === 'NFL') {
            const AMERICAN_FOOTBALL_API_KEY = process.env.AMERICAN_FOOTBALL_API_KEY;
            const response = await axios.get(
                `https://api.sportsradar.com/nfl/official/trial/v7/en/players/${playerName}/profile.json`,
                { params: { api_key: AMERICAN_FOOTBALL_API_KEY } }
            );
            const player = response.data;
            return `🏈 **Player Stats for ${player.name}**\nPassing Yards: ${player.passing.yards}\nTouchdowns: ${player.touchdowns}`;
        }
    } catch (error) {
        console.error(`Error fetching player stats for ${playerName}:`, error.message);
        return `Unable to fetch stats for ${playerName}.`;
    }
}

// Schedule Announcements
async function scheduleAnnouncements(channelId) {
    const soccerMatches = await fetchSoccerMatches();
    const nflMatches = await fetchNFLMatches();
    const allMatches = [...soccerMatches, ...nflMatches];

    allMatches.forEach((match) => {
        const announcementTime = new Date(match.time.getTime() - 10 * 60 * 1000);

        schedule.scheduleJob(announcementTime, () => {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                channel.send(
                    `📢 **Upcoming ${match.sport} Match!**\n${match.homeTeam} vs ${match.awayTeam}\nKickoff at ${match.time.toLocaleTimeString()}`
                );
            }
        });
        console.log(`Scheduled announcement for ${match.homeTeam} vs ${match.awayTeam}`);
    });
}

// Event: Ready
client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    const channelId = 'your-channel-id'; // Replace with your Discord channel ID
    await scheduleAnnouncements(channelId);
});

// Event: Commands
client.on('messageCreate', async (message) => {
    const args = message.content.split(' ');

    // Command: !ping
    if (message.content === '!ping') return message.channel.send('Pong!');

    // Command: !livescores
    if (message.content === '!livescores') {
        const scores = await fetchLiveScores();
        if (scores.length) message.channel.send(scores.join('\n'));
        else message.channel.send('No live matches at the moment.');
    }

    // Command: !standings <sport>
    if (args[0] === '!standings') {
        const sport = args[1];
        const standings = await fetchStandings(sport, args[2] || 'PL'); // Default to Premier League for Soccer
        if (standings.length) message.channel.send(standings.join('\n'));
        else message.channel.send(`No standings available for ${sport}.`);
    }

    // Command: !playerstats <playerName> <sport>
    if (args[0] === '!playerstats') {
        const playerName = args[1];
        const sport = args[2];
        const stats = await fetchPlayerStats(playerName, sport);
        message.channel.send(stats);
    }
});

// Log in
client.login(process.env.DISCORD_TOKEN).then(() => console.log('Bot login successful!'));