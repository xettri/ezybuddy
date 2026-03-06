declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*?inline' {
  const content: string;
  export default content;
}
