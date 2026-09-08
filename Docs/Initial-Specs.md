# AI Agent Requirements Document – Personal Knowledge & Flashcard System

## 1. Project overview

**Goal:**

Design and implement a personal knowledge system inspired by Anki, but extended with:

- Structured Resources (sources of knowledge) as first-class database entities.
- Multiple card types, including a Plain Knowledge type that can be transformed into questions by an LLM.
- An editable Knowledge Graph (fields and subfields) where each card can belong to multiple fields.
- A spaced repetition engine similar to Anki, driven by user feedback (easy/medium/hard).
- A flexible study flow that can select cards based on repetition needs and knowledge fields.

The system is for a single user initially, but should be architected cleanly enough to be extended into a multi-user product later.

## 2. Functional goals

1. Create and manage Resources (YouTube videos, books, articles, AI conversations, etc.).
2. Create and manage Cards of different types, linked to one or more Resources.
3. Attach per-card details to Resources (e.g., timestamp in a video, page in a book).
4. Define and edit Knowledge Fields (graph of knowledge: parent/child relationships).
5. Associate Cards with multiple Knowledge Fields (multidisciplinary knowledge).
6. Study cards using spaced repetition, with user feedback (easy/medium/hard).
7. Use an LLM to transform Plain Knowledge cards into different question styles (optional, but supported in the data model).
8. Allow the user to choose what to study: specific fields, fields + subfields, or all cards.

## 3. Data model requirements

The AI agent must design and implement a relational data model (initially for SQLite) with the following entities and relationships.

### 3.1 Resource

Represents a source of knowledge (video, book, article, AI chat, etc.).

Table: `resource`

- id: primary key.
- type: enum/string. Allowed values (at minimum): "youtube", "book", "article", "ai", "other".
- title: string. Title of the resource (e.g., video title, book title).
- author_or_channel: string. Author name or YouTube channel name.
- url: string, nullable. URL for online resources (YouTube, articles, etc.).
- editorial: string, nullable. For books (publisher/editorial).
- notes: text, nullable. General notes about the resource.
- created_at: datetime.
- updated_at: datetime.

### 3.2 Resource detail per card

Represents specific location inside a resource for a given card (e.g., timestamp in a video, page in a book).

Table: `resource_detail`

- id: primary key.
- resource_id: foreign key → resource.id.
- card_id: foreign key → card.id.
- timestamp_seconds: integer, nullable. For YouTube videos (seconds from start).
- page_number: integer, nullable. For books.
- extra: JSON/text, nullable. For future extensions (e.g., section name, chapter, etc.).

Rules:

- resource_detail is optional and only used when the resource type needs per-card location (YouTube, book).
- For articles or AI conversations, this can be left null or unused.

### 3.3 Knowledge Field (graph of knowledge)

Represents a node in the knowledge graph (e.g., "Computer Science", "Artificial Intelligence", "Linear Algebra").

Table: `knowledge_field`

- id: primary key.
- name: string. Name of the field (e.g., "Artificial Intelligence").
- description: text, nullable.
- parent_id: foreign key → knowledge_field.id, nullable. Defines hierarchy (subfields).
- order_index: integer, nullable. For ordering in UI.
- color: string, nullable. Optional visual attribute.
- icon: string, nullable. Optional visual attribute.

Rules:

- A field can have zero or one parent.
- A field can have many children.
- The user must be able to edit this graph (create, update, delete fields, change parent relationships).

### 3.4 Card–Field association (multidisciplinary)

A card can belong to multiple knowledge fields.

Table: `card_field`

- card_id: foreign key → card.id.
- field_id: foreign key → knowledge_field.id.

Rules:

- Many-to-many relationship.
- A card can be associated with multiple fields.
- A field can have many cards.

### 3.5 Card

Represents a flashcard or knowledge item.

Supported card types:

- front_back: classic question/answer.
- cloze: fill-in-the-blank style.
- custom: custom HTML/CSS/JavaScript.
- plain: plain knowledge (raw fact or statement, no explicit question).

Table: `card`

- id: primary key.
- type: enum/string. Allowed values: "front_back", "cloze", "custom", "plain".
- front: text, nullable. Used for front/back cards.
- back: text, nullable. Used for front/back cards.
- content: text, nullable. Used for plain knowledge (raw fact, statement, idea).
- cloze_text: text, nullable. Original text for cloze cards (with cloze markers or full text).
- custom_html: text, nullable. For custom cards.
- custom_css: text, nullable.
- custom_js: text, nullable.
- created_at: datetime.
- updated_at: datetime.

Rules:

- For front_back cards: front and back should be used.
- For cloze cards: cloze_text should be used (agent can define cloze syntax).
- For custom cards: custom_html, custom_css, custom_js should be used.
- For plain cards: content should be used.

### 3.6 Card–Resource association

A card can be derived from one or more resources.

Table: `card_resource`

- card_id: foreign key → card.id.
- resource_id: foreign key → resource.id.

Rules:

- Many-to-many relationship.
- A card can have multiple resources (e.g., concept explained in a book and a video).
- A resource can be linked to many cards.

### 3.7 Spaced repetition data

Stores spaced repetition state for each card.

Table: `card_review`

- id: primary key.
- card_id: foreign key → card.id.
- last_reviewed_at: datetime, nullable. Last time the card was reviewed.
- next_review_at: datetime, nullable. Next scheduled review time.
- ease_factor: float. Ease factor similar to Anki (e.g., starting around 2.5).
- interval_days: integer. Current interval in days.
- repetitions: integer. Number of successful repetitions.
- status: enum/string. Allowed values: "easy", "medium", "hard" (last user feedback).

Rules:

- The spaced repetition algorithm must be compatible with Anki-like behavior:
  - "easy" → increase ease factor, increase interval.
  - "medium" → moderate increase.
  - "hard" → decrease ease factor, shorter interval.
- next_review_at must be updated after each review based on the algorithm.

### 3.8 LLM-generated content (optional but supported)

Stores content generated by the LLM from Plain Knowledge cards.

Table: `card_generation`

- id: primary key.
- card_id: foreign key → card.id.
- mode: enum/string. Allowed values: "question", "cloze", "example", "reasoning", "random".
- generated_content: text. The generated question, cloze, example, or reasoning.
- created_at: datetime.

Rules:

- This table is optional for runtime, but must be supported in the schema.
- The agent may choose to store generated questions for later reuse or inspection.

## 4. Core flows and behaviors

### 4.1 Card creation flow (from a Resource)

1. User selects or creates a Resource:
   1. If the resource already exists, user selects it.
   2. If not, user creates a new resource (fills type, title, author/channel, URL, etc.).
2. User creates a Card:
   1. Chooses card type: front_back, cloze, custom, or plain.
   2. Fills the appropriate fields:
      1. front/back for front/back.
      2. cloze_text for cloze.
      3. custom_html/custom_css/custom_js for custom.
      4. content for plain knowledge.
3. The system links the card to the resource via card_resource.
4. If the resource type is YouTube or book:
   1. User can optionally specify timestamp_seconds (for video) or page_number (for book).
   2. System creates a resource_detail entry linking card_id and resource_id with the specific location.
5. User assigns Knowledge Fields to the card:
   1. Selects one or more fields from the knowledge graph.
   2. System creates entries in card_field.
6. System initializes spaced repetition data in card_review for the new card:
   1. Set default ease_factor, interval_days, repetitions, next_review_at (e.g., first review scheduled soon).

### 4.2 Study session and card selection

1. User chooses what to study:
   1. A specific knowledge_field.
   2. Optionally include subfields (children recursively).
   3. Or all cards (global study).
2. System retrieves candidate cards:
   1. Filter by card_field for the selected field(s).
   2. Filter by next_review_at (due or overdue cards).
3. System applies selection logic:
   1. Cards with next_review_at in the past or near future are prioritized.
   2. Cards with lower ease_factor or shorter interval_days can be given higher probability.
   3. The selection can be random but weighted by need (more needed → higher probability).
4. System presents cards to the user one by one.

### 4.3 Review feedback and spaced repetition update

For each card reviewed:

1. User marks the card as:
   1. easy
   2. medium
   3. hard
2. System updates card_review:
   1. last_reviewed_at = now.
   2. status = user choice.
   3. Update ease_factor, interval_days, repetitions, and next_review_at according to an Anki-like algorithm.
3. The updated next_review_at determines when the card will be shown again.

The agent must implement a configurable spaced repetition algorithm, inspired by Anki, but parameters (initial ease factor, multipliers, etc.) should be easy to adjust.

## 5. LLM integration requirements

The AI agent will not implement the LLM itself, but must design the backend to support it.

Requirements:

1. For Plain Knowledge cards (type = "plain"), the system must be able to:
   1. Send the content to an LLM.
   2. Request different transformation modes:
      1. "question": convert the knowledge into a question.
      2. "cloze": generate a cloze-style prompt.
      3. "example": generate a practical example.
      4. "reasoning": generate a reasoning-style explanation or chain-of-thought.
      5. "random": randomly choose one of the above modes.
2. The system must be able to store generated outputs in card_generation (optional).
3. The system must allow the user to:
   1. Use generated content directly in a study session.
   2. Or ignore it and just review the plain knowledge.

## 6. Non-functional and architectural requirements

1. Backend stack:
   1. Node.js with a web framework (e.g., Express).
   2. SQLite as the initial database (schema must be compatible with future migration to PostgreSQL).
2. Frontend stack:
   1. React for web.
   2. Flutter for mobile (later; backend API must be clean and RESTful/JSON-based).
3. Containerization:
   1. Use Podman to containerize the backend and database.
4. LLM runtime:
   1. Backend must be able to call a local LLM (e.g., via Ollama or LMStudio).
   2. The agent must design clear interfaces for LLM calls (e.g., service layer or module).
5. Extensibility:
   1. Data model must be designed to support:
      1. Additional resource types.
      2. Additional card types.
      3. Multi-user support in the future (e.g., adding user_id to key tables).
6. Privacy:
   1. All data is personal; no external sync is required initially.
   2. The system must be able to run fully locally.

## 7. Summary for the AI agent

You must:

- Design and implement the database schema described above in SQLite.
- Implement backend models, migrations, and APIs for:
  - Resources and resource details.
  - Cards and card types.
  - Knowledge fields and card–field associations.
  - Spaced repetition data and update logic.
  - Optional LLM-generated content storage.
- Implement the card creation flow from resources, including on-the-fly resource creation.
- Implement the study flow:
  - Card selection based on fields and spaced repetition.
  - User feedback (easy/medium/hard) and algorithmic updates.
- Provide a clean, well-documented codebase so that future agents or developers can extend it into a full product.

If you need a next step, I can help you refine this into API endpoints or a more detailed schema, but this document should give you a complete picture of what to build.