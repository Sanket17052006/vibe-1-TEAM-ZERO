export type Role = "student" | "employee" | "rider";
export type Status = "requested" | "accepted" | "boarding" | "completed" | "clashed" | "cancelled";
export type Boarding = "pending" | "boarded" | "missed";
export type Place = "College" | "Station" | "Office";
export type Passenger = { name: string; userId?: string; boardingStatus: Boarding };
export type Trip = { _id: string; requesterId: string; requesterName: string; from: Place; to: Place; scheduledDate: string; scheduledTime: string; passengers: Passenger[]; status: Status; createdAt: string; acceptedAt?: string; completedAt?: string };
export type User = { id: string; name: string; email: string; role: Role };
