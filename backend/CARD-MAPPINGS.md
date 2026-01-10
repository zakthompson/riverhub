# Card Mapping System

The card mapping system allows you to assign actions to RFID cards without writing any data to the cards themselves. Instead, each card's unique ID is used as a key in a mapping file.

## How It Works

1. **Card ID as Key**: Each RFID card has a permanent, unique ID that is used to look up actions
2. **No Writing Required**: Cards don't need to be written to - just tap them to register their ID
3. **Extensible**: Supports multiple action types (Sonos, lights, etc.)
4. **Persistent**: Mappings are stored in `card-mappings.json`

## Mapping File Schema

```json
{
  "cards": {
    "123456789": {
      "type": "sonos",
      "data": "title:The Sound of Music",
      "name": "River's Calm Music"
    }
  }
}
```

### Fields

- **type**: Integration type - `"sonos"`, `"lights"`, etc.
- **data**: Action payload with prefix (format depends on type)
  - For Sonos: Use `"title:..."` or `"url:..."` prefix
    - `"title:Calm River"` - Play Sonos Favorite by title
    - `"url:https://music.apple.com/..."` - Play Apple Music (uses ShareLinkPlugin)
    - `"url:spotify:playlist:..."` - Play Spotify playlist
    - `"url:x-rincon-cpcontainer:..."` - Play Sonos native URI
  - For future integrations: Could be object with settings
- **name**: (Optional) Friendly display name for the card

### Apple Music Support

Apple Music share links are automatically detected and handled using SoCo's ShareLinkPlugin:
1. Queue is cleared
2. ShareLinkPlugin parses the Apple Music URL
3. Content is added to the queue
4. Playback starts from the queue

**Supported Apple Music URLs:**
- Albums: `https://music.apple.com/album/1715961558`
- Playlists: `https://music.apple.com/playlist/pl.u-...`
- Songs: `https://music.apple.com/song/...`

**Requirements:** SoCo 0.26.0 or later (included in requirements.txt)

## Usage

### 1. Get Sonos Favorites

```bash
curl http://localhost:8765/api/favorites
```

Returns:
```json
{
  "count": 5,
  "favorites": [
    {
      "title": "The Sound of Music",
      "uri": "x-rincon-cpcontainer:..."
    }
  ]
}
```

Copy the **title** (not the URI) - you'll use this in your card mapping.

### 2. Tap an Unmapped Card

When you tap an unmapped card, the backend logs:
```
Card read: 123456789
No mapping found for card 123456789
```

The frontend receives:
```json
{
  "type": "card_read",
  "cardId": "123456789",
  "data": null,
  "timestamp": 1234567890,
  "error": "Card not registered"
}
```

### 3. Register the Card

**Option A: Via API (Favorite by Title)**

```bash
curl -X POST http://localhost:8765/api/cards/123456789 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sonos",
    "data": "title:The Sound of Music",
    "name": "River'\''s Calm Music"
  }'
```

**Option B: Via API (URL)**

```bash
curl -X POST http://localhost:8765/api/cards/123456789 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sonos",
    "data": "url:https://music.apple.com/album/1715961558",
    "name": "Apple Music Album"
  }'
```

**Option C: Manually edit `card-mappings.json`**

```json
{
  "cards": {
    "123456789": {
      "type": "sonos",
      "data": "title:The Sound of Music",
      "name": "River's Calm Music"
    },
    "987654321": {
      "type": "sonos",
      "data": "url:https://music.apple.com/album/1715961558",
      "name": "Apple Music Album"
    }
  }
}
```

**Important:**
- For favorites: Use `title:` prefix with exact title from favorites list (case-insensitive)
- For URLs: Use `url:` prefix with full URL (Apple Music, Spotify, etc.)

Save the file and restart the backend (it loads mappings on startup).

### 4. Use the Card

Tap the card again - it now plays the favorite on Sonos!

## API Endpoints

### GET /api/cards

List all card mappings.

**Response:**
```json
{
  "cards": {
    "123456789": { ... }
  }
}
```

### POST /api/cards/:cardId

Create or update a card mapping.

**Request Body:**
```json
{
  "type": "sonos",
  "data": "title:Calm River",
  "name": "Optional Name"
}
```

Or for URLs:
```json
{
  "type": "sonos",
  "data": "url:https://music.apple.com/album/1234567",
  "name": "Optional Name"
}
```

**Response:**
```json
{
  "success": true,
  "cardId": "123456789",
  "type": "sonos"
}
```

### DELETE /api/cards/:cardId

Delete a card mapping.

**Response:**
```json
{
  "success": true,
  "cardId": "123456789"
}
```

## Future Integrations

The system is designed to support any integration type:

```json
{
  "cards": {
    "111111111": {
      "type": "sonos",
      "data": "title:Calm River",
      "name": "Music Card"
    },
    "222222222": {
      "type": "lights",
      "data": {
        "scene": "bedtime",
        "brightness": 20
      },
      "name": "Bedtime Lights"
    },
    "333333333": {
      "type": "routine",
      "data": {
        "actions": ["lights:off", "sonos:pause"]
      },
      "name": "Goodnight Routine"
    }
  }
}
```

Add new integration types by:
1. Adding a case in `IntegrationService.executeCardAction()`
2. Implementing the integration service
3. Passing it to `IntegrationService` constructor
