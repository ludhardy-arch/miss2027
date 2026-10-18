export const login = (pseudo, password) => {
  if(password === "1234" && pseudo.toLowerCase() === "admin") 
      return { role: "admin" };
  if(password === "ludo") 
      return { role: "player", pseudo };
  return null;
};
