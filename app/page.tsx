import { Gallery } from "@/components/gallery"
import { SecretButton } from "@/components/secret-button"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <SecretButton />
      <Gallery />
    </main>
  )
}
