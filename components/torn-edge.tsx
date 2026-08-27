export function TornEdge({
  color = "#FAF8F4",
  flip = false,
  className = "",
}: {
  color?: string;
  flip?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 16"
      preserveAspectRatio="none"
      className={`h-4 w-full ${flip ? "rotate-180" : ""} ${className}`}
    >
      <polygon
        fill={color}
        points="0,16 0,4 10,12 20,2 30,14 40,4 50,12 60,2 70,14 80,4 90,12 100,2 110,14 120,4 130,12 140,2 150,14 160,4 170,12 180,2 190,14 200,4 210,12 220,2 230,14 240,4 250,12 260,2 270,14 280,4 290,12 300,2 310,14 320,4 330,12 340,2 350,14 360,4 370,12 380,2 390,14 400,4 400,16"
      />
    </svg>
  );
}