export default function isVideoFile(name: string) {
  return /\.(mp4|mkv|avi|mov|wmv|flv|webm|mpg|mpeg)$/i.test(name);
}
