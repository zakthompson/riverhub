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
      "id": "123456789",
      "type": "sonos",
      "data": "x-rincon-cpcontainer:1006206clibraryplaylist%3Ap.VJabuoWQJ44?sid=204&flags=8300&sn=1",
      "name": "The Sound of Music"
    }
  }
}
```

### Fields

- **id**: Card's unique identifier (matches the key)
- **type**: Integration type - `"sonos"`, `"lights"`, etc.
- **data**: Action payload (format depends on type)
  - For Sonos: Favorite URI string
  - For future integrations: Could be object with settings
- **name**: (Optional) Friendly name for the card

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
      "uri": "x-rincon-cpcontainer:1006206clibraryplaylist%3Ap.VJabuoWQJ44?sid=204&flags=8300&sn=1"
    }
  ]
}
```

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

**Option A: Via API**

```bash
curl -X POST http://localhost:8765/api/cards/123456789 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sonos",
    "data": "x-rincon-cpcontainer:1006206clibraryplaylist%3Ap.VJabuoWQJ44?sid=204&flags=8300&sn=1",
    "name": "The Sound of Music"
  }'
```

**Option B: Manually edit `card-mappings.json`**

```json
{
  "cards": {
    "123456789": {
      "id": "123456789",
      "type": "sonos",
      "data": "x-rincon-cpcontainer:1006206clibraryplaylist%3Ap.VJabuoWQJ44?sid=204&flags=8300&sn=1",
      "name": "The Sound of Music"
    }
  }
}
```

Save the file - the backend loads it on startup.

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
  "data": "x-rincon-cpcontainer:...",
  "name": "Optional Name"
}
```

**Response:**
```json
{
  "success": true,
  "cardId": "123456789",
  "type": "sonos",
  "name": "Optional Name"
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
      "id": "111111111",
      "type": "sonos",
      "data": "x-rincon-cpcontainer:..."
    },
    "222222222": {
      "id": "222222222",
      "type": "lights",
      "data": {
        "scene": "bedtime",
        "brightness": 20
      }
    },
    "333333333": {
      "id": "333333333",
      "type": "routine",
      "data": {
        "actions": ["lights:off", "sonos:pause"]
      }
    }
  }
}
```

Add new integration types by:
1. Adding a case in `IntegrationService.executeCardAction()`
2. Implementing the integration service
3. Passing it to `IntegrationService` constructor
