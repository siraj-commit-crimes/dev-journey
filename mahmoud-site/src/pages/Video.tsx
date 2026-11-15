import ScrollReveal from "@/components/ScrollReveal";
import video from "@/assets/video.mp4";

const Video = () => (
  <main className="min-h-screen pt-24 md:pt-32 pb-24 px-6 md:px-12">
    <div className="max-w-4xl mx-auto text-center">
      <ScrollReveal>
        <h1 className="text-section-title text-foreground mb-4">Video</h1>
        <div className="w-[60px] h-px bg-foreground/20 mx-auto mb-20" />
      </ScrollReveal>
      <ScrollReveal>
        <div className="aspect-video bg-secondary border border-border overflow-hidden rounded-sm">
          <video src={video} controls className="w-full h-full object-cover" playsInline>
            Your browser does not support the video tag.
          </video>
        </div>
      </ScrollReveal>
      <ScrollReveal>
        <p className="text-muted-foreground text-sm mt-12 tracking-wide">Georges Hobeika - Fashion Show.</p>
      </ScrollReveal>
    </div>
  </main>
);

export default Video;
