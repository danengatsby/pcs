export const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;

export const strongPasswordMessage =
  "Parola trebuie sa aiba minim 10 caractere si sa contina litera mare, litera mica, cifra si simbol.";
