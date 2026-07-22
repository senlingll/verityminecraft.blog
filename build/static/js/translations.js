// AI Poem Generator - Frontend Translations Configuration
window.FRONTEND_TRANSLATIONS = {
    en: {
        // Notifications
        notifications: {
            errorMinLength: 'Please enter a poem idea (at least 3 characters)',
            errorGeneration: 'Failed to generate poem. Please try again.',
            rateLimitExceeded: 'Daily limit exceeded. Please try again tomorrow.',
            copySuccess: 'Poem copied to clipboard!',
            copyError: 'Failed to copy poem',
            downloadSuccess: 'Poem downloaded!',
        },
        
        // Loading messages
        loading: {
            analyzing: 'Analyzing your theme...',
            composing: 'Composing verses & stanzas...',
            polishing: 'Polishing final poem...',
        },
        
        // Share
        share: {
            title: 'AI Generated Poem',
            text: 'Check out this AI generated poem!'
        },
        
        // Rate limit
        rateLimit: {
            exceeded: 'Daily limit of free generations exceeded.',
            tryAgainIn: 'You can try again in {hours} hours.',
            remaining: 'You have {count} generation remaining today.',
            remainingPlural: 'You have {count} generations remaining today.'
        },

        // Sample ideas for "Try a Sample" button
        sampleIdeas: [
            "Write a heartfelt love poem about finding hope and strength in difficult times. Include themes of resilience, support, and the power of love to overcome challenges.",
            "Create an acrostic poem using the word HOPE. Each line should start with the corresponding letter and convey a message of optimism and perseverance.",
            "Write a haiku about autumn leaves falling gently to the ground. Capture the beauty and transience of the season.",
            "Create a sonnet about the beauty of a sunset over the ocean. Include vivid imagery of colors, waves, and the feeling of peace.",
            "Write a poem about the journey of self-discovery and finding your true purpose in life. Include themes of growth, reflection, and inner strength.",
            "Create an acrostic poem using the name SARAH. Make it a heartfelt tribute celebrating her qualities and the joy she brings.",
            "Write a limerick about a curious cat who loves to explore. Make it humorous and playful with a clever twist at the end.",
            "Create a free verse poem about the magic of a starry night sky. Include imagery of constellations, wonder, and infinite possibilities."
        ]
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.FRONTEND_TRANSLATIONS;
}
