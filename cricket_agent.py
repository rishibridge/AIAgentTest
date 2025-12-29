import os
import sys
import warnings
warnings.filterwarnings("ignore")
from dotenv import load_dotenv
from ddgs import DDGS
from google import genai
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

# Initialize Rich Console
console = Console()

def setup_client():
    """Load environment variables and configure API."""
    load_dotenv()
    api_key = os.getenv("GOOGLE_API_KEY")
    
    if not api_key or api_key == "your_api_key_here":
        console.print(Panel("[bold red]Error: GOOGLE_API_KEY not found![/bold red]\n\nPlease check your .env file.\n1. Rename .env.example to .env\n2. Add your Gemini API key inside it.", title="Configuration Error"))
        return None
        
    client = genai.Client(api_key=api_key)
    return client

def search_scores(query="live cricket scores"):
    """Search for cricket scores using DuckDuckGo."""
    console.print(f"[cyan]Searching for: {query}...[/cyan]")
    try:
        with DDGS() as ddgs:
            # We search for slightly more results to ensure we get good coverage
            results = list(ddgs.text(query, max_results=5))
            return results
    except Exception as e:
        console.print(f"[bold red]Search failed:[/bold red] {e}")
        return []

def analyze_scores(client, search_results, user_query):
    """Use Gemini to summarize the search results."""
    console.print("[cyan]Analyzing matches with AI...[/cyan]")
    
    # Using the stable model
    model_id = 'gemini-2.0-flash'
    
    prompt = f"""
    You are a Cricket Specialist AI. 
    
    User Query: {user_query}
    
    Here is the recent search data about cricket matches:
    {search_results}
    
    Please provide a response with two sections:
    
    1. **Summary**: A quick, high-level overview of the most important ongoing or recently concluded matches.
    2. **Detailed Scores**: A detailed breakdown of the scorecards found in the data. Include runs, wickets, overs, and key performers if available.
    
    Format your response in Markdown. If the data is old or unclear, state that clearly.
    """
    
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=prompt
        )
        return response.text
    except Exception as e:
        return f"AI Analysis failed: {e}"

def main():
    client = setup_client()
    if not client:
        return

    console.print(Panel("[bold green]Cricket Score Agent[/bold green]\nAsk me about specific matches or just hit Enter for live scores.", subtitle="Powered by Gemini & DuckDuckGo"))

    while True:
        try:
            user_input = console.input("\n[bold yellow]Which match? (or 'q' to quit) > [/bold yellow]")
            
            if user_input.lower() in ['q', 'quit', 'exit']:
                console.print("[green]Goodbye![/green]")
                break
                
            query = user_input if user_input.strip() else "live cricket scores international t20 odi test"
            
            # 1. Search
            results = search_scores(query)
            
            if not results:
                console.print("[red]No search results found. Try again.[/red]")
                continue
                
            # 2. Analyze
            analysis = analyze_scores(client, results, query)
            
            # 3. specific match formatting
            console.print(Panel(Markdown(analysis), title="Match Report"))
            
        except KeyboardInterrupt:
            console.print("\n[green]Goodbye![/green]")
            break

if __name__ == "__main__":
    main()
