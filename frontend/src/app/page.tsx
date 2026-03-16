
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";


export default function Home() {
  return (
    <div >
      <main >
        <div>
          <h1 >{API_URL}</h1>
        </div>
        <div >
          <p >{API_URL}</p>
        </div>
      </main>
    </div>
  );
}
