
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";


export default function Home() {
  return (
    <div >
      <main >
        <div>
          <h1>DocQuery</h1>
        </div>
        <div >
          <p >{API_URL}</p>
          <ul>
            <li><a href={API_URL}>Documents</a> </li>
            <li><a href={API_URL}>Upload</a>    </li>
            <li><a href={API_URL}>Delete</a>    </li>
            <li><a href={API_URL}>Chat</a>    </li>
          </ul>
        </div>
      </main >
    </div >
  );
}
