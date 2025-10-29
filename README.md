# QuizSpark

[cloudflarebutton]

QuizSpark is a real-time, interactive quiz game platform for engaging audiences, inspired by Kahoot and built on Cloudflare Workers and Durable Objects.

## Description

QuizSpark is designed for live events, classrooms, or social gatherings. The application is split into two primary experiences: a 'Host' view, displayed on a shared screen, and a 'Player' view on individual mobile devices. The Host controls the game's flow, starting the quiz, advancing through questions, and displaying leaderboards. Players join a specific game session using a unique game PIN or by scanning a QR code, enter a nickname, and use their device as a controller to answer questions. Scoring is based on both the correctness of the answer and the speed of response. The entire game state is managed centrally by a Cloudflare Durable Object, ensuring a single source of truth and a seamless real-time experience simulated via efficient short-polling.

## Key Features

-   **Real-time Gameplay**: Engage audiences with live, interactive quizzes.
-   **Dual-Screen Experience**: Separate, synchronized views for the Host (main screen) and Players (mobile devices).
-   **Easy Joining**: Players can join games quickly using a simple Game PIN or a QR code.
-   **Dynamic Scoring**: Points are awarded for both correct answers and response speed.
-   **Centralized State Management**: Powered by a single global Cloudflare Durable Object for robust and consistent game state.
-   **Interactive UI**: A playful and responsive design built with modern web technologies.

## Technology Stack

-   **Frontend**: React, React Router, TypeScript, Tailwind CSS, shadcn/ui
-   **State Management**: Zustand
-   **Animations**: Framer Motion
-   **Backend**: Cloudflare Workers, Hono
-   **Stateful Backend**: Cloudflare Durable Objects
-   **Build Tool**: Vite
-   **Package Manager**: Bun

## Getting Started

Follow these instructions to get a local copy of the project up and running for development and testing purposes.

### Prerequisites

-   [Bun](https://bun.sh/) installed on your machine.
-   [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) CLI. You can install it globally via bun:
    ```bash
    bun install -g wrangler
    ```
-   A Cloudflare account. Log in to your account by running:
    ```bash
    wrangler login
    ```

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd quizspark
    ```

2.  **Install dependencies:**
    The project uses Bun as the package manager.
    ```bash
    bun install
    ```

### Running the Development Server

To start the development server, which includes the Vite frontend and the local Wrangler server for the worker, run:

```bash
bun dev
```

This command will:
-   Start the React application on `http://localhost:3000` (or another available port).
-   Start the Cloudflare Worker locally.
-   Vite is configured to proxy API requests from `/api/*` to the local worker, enabling seamless full-stack development.

## Project Structure

-   `src/`: Contains the frontend React application, including pages, components, hooks, and styles.
-   `worker/`: Contains the backend Cloudflare Worker code, including the Hono API routes (`userRoutes.ts`) and the Durable Object implementation (`durableObject.ts`).
-   `shared/`: Contains TypeScript types that are shared between the frontend and the backend to ensure type safety.
-   `wrangler.jsonc`: Configuration file for the Cloudflare Worker and Durable Object bindings. **Do not modify this file.**

## Deployment

This project is configured for easy deployment to Cloudflare's global network.

1.  **Build and Deploy:**
    Run the deploy script, which will build the React application and deploy it along with the Worker to your Cloudflare account.

    ```bash
    bun run deploy
    ```

2.  **One-Click Deploy:**
    Alternatively, you can deploy this project to Cloudflare with a single click.

    [cloudflarebutton]

## License

This project is licensed under the MIT License.