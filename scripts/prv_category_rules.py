"""Validation rules and metadata for patron review generation."""

# Product name must NOT appear in review bodies (shown separately in purchase row)
BANNED_BODY_PATTERNS = [
    r"\{\{\s*prv_short\s*\}\}",
    r"\bprv_short\b",
    r"\bnatural ingredients\b",
    r"\bpremium texture\b",
    r"\bsolar glow\b",
    r"\bcrown light\b",
    r"\benergy balance\b",
    r"\b(pure|woody|floral|sandalwood|resin)\s+notes\b",
    r"\bdry-down\b",
    r"\bsillage\b",
    r"\bprojection\b",
    r"\bcured my\b",
    r"\bhealed my\b",
    r"\bchanged my destiny\b",
    r"\bgraha dosha\b",
    r"\b(cured my|healed my|it's a miracle|ye miracle|miracle cure)\b",
]

FORBIDDEN = {
    "incense": [
        "pulse point", "wrist", "on skin", "skin par", "office wear", "date night",
        "perfume", "sillage", "projection", "layering", "attar", "kurta par",
        "neck dot", "hotel lobby", "gym", "alcohol",
    ],
    "chakra": [
        "office", "gym", "hotel lobby", "boardroom", "elevator", "meeting",
        "commute", "metro", "presentation", "workout", "cured", "healed",
    ],
    "planet": [
        "surya", "chandra", "mangal", "budh", "shukra", "shani", "rahu", "ketu",
        "aries", "leo", "zodiac", "nakshatra", "chakra", "date night", "destiny",
        "graha dosha", "miracle",
    ],
    "zodiac": [
        "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio",
        "nakshatra", "navagraha", "graha shanti", "destiny", "miracle",
    ],
    "nakshatra": [
        "office", "gym", "hotel", "travel memory", "flight", "airport", "crowd",
        "headache prone", "portable ritual", "zodiac", "aries", "graha",
    ],
    "love": ["puja", "agarbatti", "incense stick", "graha", "navagraha", "chakra"],
    "stress": ["date night", "wedding sangeet", "agarbatti"],
    "spiritual": ["office wear", "gym", "date night", "hotel lobby"],
    "meditation": ["office wear", "gym", "date night", "wedding guest", "hotel lobby"],
}

TAGS = {
    "incense": [
        "Morning Puja", "Evening Aarti", "Slow Burn", "Natural Aroma", "Temple Use",
        "Meditation", "Home Fragrance", "Clean Smoke", "Daily Ritual", "Festive Puja",
    ],
    "chakra": [
        "Meditation", "Yoga", "Mindful Routine", "Self Care", "Breathwork",
        "Evening Ritual", "Morning Practice", "Quiet Moment", "Body Massage", "Calm Routine",
    ],
    "planet": [
        "Daily Ritual", "Temple Visit", "Morning Prayer", "Spiritual Routine",
        "Evening Aarti", "Quiet Wear", "Puja Time", "Grounding", "Meditation", "Family Puja",
    ],
    "zodiac": [
        "Daily Signature", "Rashi Gift", "Astrology Lover", "Birthday Gift",
        "Personal Scent", "Subtle Compliment", "Daily Wear", "Evening Wear", "Self Gift", "Wedding Guest",
    ],
    "nakshatra": [
        "Birth Star", "Spiritual Practice", "Evening Prayer", "Vedic Tradition",
        "Personal Ritual", "Family Astrologer", "Inner Calm", "Meditation", "Meaningful Gift", "Janma Nakshatra",
    ],
    "love": [
        "Anniversary", "Date Night", "Romantic Gift", "Wedding Season", "Evening Out",
        "Partner Gift", "Soft Compliment", "Special Occasion", "Honeymoon", "Intimate Wear",
    ],
    "stress": [
        "Sleep Routine", "Evening Relax", "Yoga Calm", "Desk Unwind", "Night Ritual",
        "Quiet Evening", "Calm Mind", "Self Care", "Before Bed", "Sunday Reset",
    ],
    "perfume": [
        "Office Wear", "Daily Wear", "Travel", "Long Lasting", "Signature Scent",
        "Meeting Day", "Commute", "Evening Out", "Sensitive Skin", "Weekday Staple",
    ],
    "luxury": [
        "Special Occasion", "Elegant Bottle", "Long Lasting", "Refined Scent",
        "Heirloom Gift", "Evening Event", "Collector", "Premium Feel", "Unboxing", "Anniversary",
    ],
    "spiritual": [
        "Puja Ritual", "Temple Visit", "Meditation", "Evening Aarti", "Diya Lighting",
        "Morning Prayer", "Sacred Routine", "Family Puja", "Quiet Devotion", "Pilgrimage",
    ],
    "bestseller": [
        "First Purchase", "Friend Referral", "Daily Wear", "Gift Choice", "Festival Buy",
        "Repeat Purchase", "Family Pick", "Wedding Guest", "Online Order", "Trusted Pick",
    ],
    "gift": [
        "Premium Packaging", "Festive Gift", "Birthday Gift", "Wedding Gift",
        "Anniversary Box", "Unboxing", "Diwali Hamper", "Thank You Gift", "Luxury Presentation", "Housewarming",
    ],
    "apsara": [
        "Classical Dance", "Sangeet Night", "Bridal Prep", "Stage Wear", "Heritage Wedding",
        "Photo Shoot", "Performance Day", "Artistic Gift", "Evening Event", "Cultural Program",
    ],
    "astrology": [
        "Chart Reading", "Remedy Routine", "Star Sign Gift", "Muhurat Buy", "Retrograde Season",
        "Astrology Club", "Birthday Month", "Couple Gift", "Ritual Day", "Forecast Night",
    ],
    "mood": [
        "Rainy Day", "Slow Sunday", "Self Care", "Journal Hour", "Balcony Evening",
        "Creative Afternoon", "Quiet Morning", "Cozy Evening", "Feel Good", "Weekend Ritual",
    ],
    "festival": [
        "Diwali Prep", "Navratri", "Family Gathering", "Puja Week", "Festive Home",
        "Pandal Visit", "Holiday Ritual", "Gift Season", "Tradition", "Celebration",
    ],
    "daily": [
        "Office Wear", "Daily Wear", "Commute", "Weekday Staple", "WFH Routine",
        "Subtle Trail", "Desk Friendly", "Morning Routine", "Evening Walk", "All Day Wear",
    ],
    "meditation": [
        "Morning Sit", "Breathwork", "Silent Retreat", "Mantra Hour", "Cushion Calm",
        "Yoga Nidra", "Temple Garden", "Quiet Room", "Focus Time", "Evening Sit",
    ],
    "premium": [
        "Special Occasion", "Collector", "Heirloom Gift", "Consult Pick", "Flagship Visit",
        "Anniversary", "Long Lasting", "Rare Batch", "Evening Gala", "Premium Feel",
    ],
    "limited": [
        "Drop Day", "Waitlist Win", "Numbered Bottle", "Launch Day", "Collector",
        "Early Access", "Seasonal Batch", "Exclusive Wear", "Gift Moment", "Anniversary Edition",
    ],
    "seasonal": [
        "Monsoon Wear", "Winter Evening", "Summer Wedding", "Hill Trip", "Festive Week",
        "Humid Days", "Cool Weather", "Shawl Season", "Travel Days", "Seasonal Ritual",
    ],
    "generic": [
        "First Purchase", "Daily Wear", "Gift Choice", "Wedding Guest", "Travel Bottle",
        "Online Order", "Friend Referral", "Festival Buy", "Repeat Purchase", "New Customer",
    ],
}

PURCHASE_CONTEXT = [
    "Verified purchase", "Repeat purchase", "First purchase", "Gift from spouse",
    "Gift from family", "Friend recommended", "Festival purchase", "Online order",
    "Wedding season buy", "Anniversary gift", "Self-care treat", "Astrologer suggested",
    "Mother's gift", "Office colleague tip", "Social media find", "Store visit",
]

# Short optional third tag — human phrases only
CONTEXT_NOTE = {
    "incense": ["After puja", "Morning routine", "Guest noticed", "Slow evening burn", "Temple day"],
    "chakra": ["Before yoga", "After shower", "Evening calm", "Weekend practice", "Quiet hour"],
    "nakshatra": ["Birth star day", "Evening prayer", "Family puja", "Astrologer visit", "Janma star gift"],
    "planet": ["Morning puja", "Temple visit", "Sunday havan", "Evening aarti", "Quiet ritual"],
    "perfume": ["Office day", "Client lunch", "Travel week", "Weekday wear", "Evening out"],
}

DEFAULT_CONTEXT_NOTE = ["Daily use", "Evening routine", "Weekend wear", "Family liked it", "Will reorder"]
