import type { Question, Quiz } from '@shared/types';

export const GENERAL_KNOWLEDGE_QUIZ: Question[] = [
	{
		text: 'What is the capital of France?',
		options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
		correctAnswerIndex: 2,
	},
	{
		text: 'Which planet is known as the Red Planet?',
		options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
		correctAnswerIndex: 1,
	},
	{
		text: 'What is the largest ocean on Earth?',
		options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
		correctAnswerIndex: 3,
		isDoublePoints: true,
	},
	{
		text: "Who wrote 'To Kill a Mockingbird'?",
		options: ['Harper Lee', 'J.K. Rowling', 'Ernest Hemingway', 'Mark Twain'],
		correctAnswerIndex: 0,
	},
];

const TECH_QUIZ: Question[] = [
	{
		text: "What does 'CPU' stand for?",
		options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Processor Unit', 'Control Processing Unit'],
		correctAnswerIndex: 0,
	},
	{
		text: 'Which company developed the JavaScript programming language?',
		options: ['Microsoft', 'Apple', 'Netscape', 'Sun Microsystems'],
		correctAnswerIndex: 2,
	},
	{
		text: 'What is the main function of a DNS server?',
		options: ['To store websites', 'To resolve domain names to IP addresses', 'To send emails', 'To secure network connections'],
		correctAnswerIndex: 1,
		isDoublePoints: true,
	},
];

const GEOGRAPHY_QUIZ: Question[] = [
	{
		text: 'What is the longest river in the world?',
		options: ['Amazon River', 'Nile River', 'Yangtze River', 'Mississippi River'],
		correctAnswerIndex: 1,
	},
	{
		text: 'Which desert is the largest in the world?',
		options: ['Sahara Desert', 'Arabian Desert', 'Gobi Desert', 'Antarctic Polar Desert'],
		correctAnswerIndex: 3,
	},
	{
		text: 'What is the capital of Australia?',
		options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'],
		correctAnswerIndex: 2,
		isDoublePoints: true,
	},
];

export const PREDEFINED_QUIZZES: Quiz[] = [
	{ id: 'general', title: 'General Knowledge', questions: GENERAL_KNOWLEDGE_QUIZ, type: 'predefined' },
	{ id: 'tech', title: 'Tech Trivia', questions: TECH_QUIZ, type: 'predefined' },
	{ id: 'geo', title: 'World Geography', questions: GEOGRAPHY_QUIZ, type: 'predefined' },
];
